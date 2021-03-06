var _ = require('underscore');
var $ = require('jquery-browserify');
var Backbone = require('../lib/backbone');
var Handlebars = require('handlebars');

/** Map Views **/

var legFromBubbleTemplate = Handlebars.compile([
    '<div class="otp-legBubble-icon-topRow-{{orientation}}">',
        '<div class="otp-legBubble-arrow-right" style="float: left; margin-left:4px;"></div>',
        '<div style="width: 16px; height: 16px; margin-left: 12px;">',
            '<div class="otp-modeIcon-{{mode}}" style="margin: auto auto;"></div>',
            '<div class="otp-routeShortName">{{routeShortName}}</div>',
        '</div>',
    '</div>',
    '{{{formatTime from.departure format="h:mm"}}}'
].join('\n'));

module.exports.OtpItineraryMapView = Backbone.View.extend({
 
    initialize : function() {
        this.attachedToMap = false;
        this.pathLayer = new L.LayerGroup();
        this.pathMarkerLayer = new L.LayerGroup();
        this.highlightLayer = new L.LayerGroup();

        this.listenTo(this.model, "activate", function() {
            this.preview = false;
            this.render();
            //this.options.map.fitBounds(this.model.getBoundsArray())
        });
        this.listenTo(this.model, "deactivate", this.clearLayers);

        this.listenTo(this.model, "mouseenter", function() {
            this.preview = true;
            this.render();
        });
        this.listenTo(this.model, "mouseleave", this.clearLayers);

        for(var l=0; l < this.model.get('legs').length; l++) {
           var leg = this.model.get('legs').at(l);

            this.listenTo(leg, "mouseenter", _.bind(function() {
                this.view.highlightLeg = this.leg;
                this.view.render();
            }, {view: this, leg : leg}));

            this.listenTo(leg, "mouseleave", _.bind(function() {
                this.view.highlightLeg = null;
                this.view.render();
            }, {view: this, leg : leg}));

            this.listenTo(leg, "fromclick", _.bind(function() {
                this.view.options.map.panTo([this.leg.get("from").lat, this.leg.get("from").lon]);
            }, {view: this, leg : leg}));

            this.listenTo(leg, "toclick", _.bind(function() {
                this.view.options.map.panTo([this.leg.get("to").lat, this.leg.get("to").lon]);
            }, {view: this, leg : leg}));

            var steps = leg.get('steps');
            if(!steps) continue;
            for(var s=0; s < steps.length; s++) {
                var step = steps.at(s);

                this.listenTo(step, "click", _.bind(function() {
                    this.view.options.map.panTo([this.step.get('lat'), this.step.get('lon')]);
                }, {view: this, step : step}));
    
                this.listenTo(step, "mouseenter", _.bind(function() {
                    //var popup = L.popup()
                    //.setLatLng([this.step.get('lat'), this.step.get('lon')])
                    //.setContent(this.step.get('streetName'))
                    //.openOn(this.view.options.map);
                }, {view: this, step : step}));

                this.listenTo(step, "mouseleave", _.bind(function() {
                    this.view.options.map.closePopup();
                }, {view: this, step : step}));

            }
        }
    },

    attachToMap : function() {
        this.options.map.addLayer(this.highlightLayer);
        this.options.map.addLayer(this.pathLayer);
        this.options.map.addLayer(this.pathMarkerLayer);
        this.attachedToMap = true;
    },

    detachFromMap : function() {
        this.options.map.removeLayer(this.highlightLayer);
        this.options.map.removeLayer(this.pathLayer);
        this.options.map.removeLayer(this.pathMarkerLayer);
        this.attachedToMap = false;
    },

    render : function() {
               
        if(!this.attachedToMap) this.attachToMap();
        this.clearLayers();

        var mapBounds = new L.LatLngBounds()


        for(var i=0; i < this.model.get('legs').length; i++) {
            var leg = this.model.get('legs').at(i);

            var points = OTP.utils.decodePolyline(leg.get('legGeometry').points);
            var weight = 8;

            // draw highlight, if applicable
            if(this.highlightLeg === leg) {
                var highlight = new L.Polyline(points);
                highlight.setStyle({
                    color : "#ffff00",
                    weight: weight * 2,
                    opacity: this.preview ? 0.75 : 0.75
                });
                this.highlightLayer.addLayer(highlight);
            }

            // draw the polyline
            var polyline = new L.Polyline(points);
            polyline.setStyle({
                color : leg.getMapColor(),
                weight: weight,
                opacity: this.preview ? 0.75 : 0.75
            });
            this.pathLayer.addLayer(polyline);
            polyline.leg = leg;

            mapBounds.extend(polyline.getBounds());

            if(leg.get('mode') == "WALK" || leg.get('mode') == "BICYCLE") {
                var popupContent = '<img src="../src/images/mode/' + leg.get('mode').toLowerCase() + '.png"/> <img src="../src/images/mode/arrow_right.png"/> ' + leg.get('to').name;

                popupContent += '<br/>';

                var minutes = leg.get('duration') / 1000 / 60;
                popupContent += Math.round(minutes) + ' mins ';

                var distance = OTP.utils.distanceString(leg.get('distance'));
                popupContent += distance;

                polyline.bindLabel(popupContent);

                for(var step in leg.get('steps').models) {
                    this.pathMarkerLayer.addLayer(this.getStepBubbleMarker(leg, leg.get('steps').models[step]));
                }
            }
            else if (leg.get('mode') == "BUS") {
                var popupContent = '<img src="../src/images/mode/bus.png"/> ';

                if(leg.get('routeShortName'))
                    popupContent += leg.get('routeShortName');

                if(leg.get('routeLongName')) {
                    if(popupContent != '')
                        popupContent += ' ';

                    popupContent += leg.get('routeLongName') + '<br/> ';
                }

                popupContent += ' <img src="../src/images/mode/arrow_right.png"/> ' + leg.get('to').name;


                var minutes = leg.get('duration') / 1000 / 60;
                popupContent += ' (' + Math.round(minutes) + ' mins)';

                polyline.bindLabel(popupContent);
            }

            var marker = this.getLegFromBubbleMarker(leg, this.highlightLeg === leg);
            this.pathMarkerLayer.addLayer(marker);
        }

        this.options.map.fitBounds(mapBounds);
    },

    getStepBubbleMarker : function(leg, step) {
        
        var marker = new L.CircleMarker([step.get('lat'), step.get('lon')], { color: '#666', stroke: 3, radius: 5, fillColor: '#aaa', opacity: 1.0, fillOpacity: 1.0});

        if(step.get('relativeDirection')) {

            var popupContent = '<span class="otp-legStepLabel-icon otp-legStep-icon-' + step.get('relativeDirection') + '"></span>' + ' <img src="../src/images/mode/' + leg.get('mode').toLowerCase() + '.png"/> ' + step.get('streetName');

            popupContent += ' (';

            var distance = OTP.utils.distanceString(step.get('distance'));
            
            popupContent += distance + ' )';


            marker.bindLabel(popupContent);

        }

        return marker;
    },

    getLegFromBubbleMarker : function(leg, highlight) {
        //var quadrant = (leg.get('from').lat < leg.get('to').lat ? 's' : 'n') + (leg.get('from').lon < leg.get('to').lon ? 'w' : 'e');        highlight = highlight || false;
        
        //var context = _.clone(leg.attributes);
        //context.orientation = quadrant[0];

        var popupContent = '<img src="../src/images/mode/arrow_right.png"/> <img src="../src/images/mode/' + leg.get('mode').toLowerCase() + '.png"/> ';

        if(leg.get('routeShortName'))
            popupContent += leg.get('routeShortName');

        if(leg.get('routeLongName')) {
            if(popupContent != '')
                popupContent += ' ';

            popupContent += leg.get('routeLongName');
        }

        popupContent += ' ' + OTP.utils.formatTime(leg.get('startTime')) + ' ';

        var marker = new L.CircleMarker([leg.get('from').lat, leg.get('from').lon], { color: '#000', stroke: 10, radius: 5, fillColor: '#fff', opacity: 1.0, fillOpacity: 1.0});

        marker.bindLabel(popupContent);

        return marker;
    },

    getLegBubbleAnchor : function(quadrant) {
        if(quadrant === 'nw') return [32,44];
        if(quadrant === 'ne') return [0,44];
        if(quadrant === 'sw') return [32,0];
        if(quadrant === 'se') return [0,0];
    },

    clearLayers : function() {
        this.pathLayer.clearLayers();
        this.pathMarkerLayer.clearLayers();        
        this.highlightLayer.clearLayers();        
    }
});


/*var StartFlagIcon = L.Icon.extend({
    options: {
        iconUrl: 'images/marker-flag-start-shadowed.png',
        shadowUrl: null,
        iconSize: new L.Point(48, 49),
        iconAnchor: new L.Point(46, 42),
        popupAnchor: new L.Point(0, -16)
    }
});*/



module.exports.OtpRequestMapView = Backbone.View.extend({
 
    initialize : function() {

        _.bindAll(this, 'markerMove', 'mapClick');

        this.model.on('change', this.render, this);

        var view = this;
        this.options.map.on('click', function(evt) {
            view.mapClick(evt.latlng);
        });

        this.attachedToMap = false;

        this.markerLayer = new L.LayerGroup();
    },

    attachToMap : function() {
        this.options.map.addLayer(this.markerLayer);
        this.attachedToMap = true;
    },

    detachFromMap : function() {
        this.options.map.removeLayer(this.markerLayer);
        this.attachedToMap = false;
    },

    render : function() {
        if(!this.attachedToMap) this.attachToMap();
        this.clearLayers();

        if(this.model.getFromLatLng()) {
            this.startMarker = new L.Marker(this.model.getFromLatLng(), {
                icon: new L.DivIcon({
                    className : 'otp-startFlagIcon',
                    iconSize: null,
                    iconAnchor: null,
                }),
                draggable: true
            });
            this.startMarker.bindLabel('<strong>Start</strong>');
            this.startMarker.on('dragend', $.proxy(function() {
                this.markerMove(this.startMarker.getLatLng(), null);
            }, this));
            this.markerLayer.addLayer(this.startMarker);
        } 
        
        if(this.model.getToLatLng()) {
            this.endMarker = new L.Marker(this.model.getToLatLng(), {
                icon: new L.DivIcon({
                    className : 'otp-endFlagIcon',
                    iconSize: null,
                    iconAnchor: null,
                }),
                draggable: true
            });
            this.endMarker.bindLabel('<strong>End</strong>');
            this.endMarker.on('dragend', $.proxy(function() {
                
                this.markerMove(null, this.endMarker.getLatLng());

            }, this));
            this.markerLayer.addLayer(this.endMarker);
        }

    },

    mapClick: function (latlng) {

        if(!this.model.attributes.fromPlace)
          this.model.set({fromPlace: latlng.lat + ',' + latlng.lng});
        else if(!this.model.attributes.toPlace)
          this.model.set({toPlace: latlng.lat + ',' + latlng.lng});

    },

    markerMove: function (start, end) {

        if(start) {
          this.model.set({fromPlace: start.lat + ',' + start.lng});
        }

        if(end) {
          this.model.set({toPlace: end.lat + ',' + end.lng});
        }
    },

    clearLayers : function() {
        this.markerLayer.clearLayers();
    }
});


// views for the stops overlay

module.exports.OtpStopsRequestMapView = Backbone.View.extend({
 
    initialize : function() {
        _.bindAll(this, "mapViewChanged");

        if(!this.options.minimumZoom) this.options.minimumZoom = 15;

        this.options.map.on("viewreset dragend", this.mapViewChanged);
    },

    mapViewChanged : function(e) {
        if(this.options.map.getZoom() < this.options.minimumZoom) return;

        var data = {
            leftUpLat: this.options.map.getBounds().getNorth(), 
            leftUpLon: this.options.map.getBounds().getWest(),
            rightDownLat: this.options.map.getBounds().getSouth(),
            rightDownLon: this.options.map.getBounds().getEast()
        };

        this.model.set(data);        
    }
});

module.exports.OtpStopsResponseMapView = Backbone.View.extend({
 
    initialize : function() {
        _.bindAll(this, "mapViewChanged");

        this.markerLayer = new L.LayerGroup();
        this.options.map.addLayer(this.markerLayer);
        this.options.map.on("viewreset dragend", this.mapViewChanged);
    },

    render : function() {
        this.markerLayer.clearLayers();
        _.each(this.model.get('stops').models, function(stop) {
            var stopMarker = new L.CircleMarker([stop.get('stopLat'), stop.get('stopLon')], { 
                color: '#666',
                stroke: 2,
                radius: 4,
                fillColor: '#eee', 
                opacity: 1.0, 
                fillOpacity: 1.0
            });
            stopMarker.bindLabel(stop.get('stopName'));
            
            this.markerLayer.addLayer(stopMarker);

        }, this);

    },

    newResponse : function(response) {
        this.model = response;
        this.render();
    },

    mapViewChanged : function(e) {
        this.markerLayer.clearLayers();
    }
});