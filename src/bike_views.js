var _ = require('underscore');
var $ = require('jquery-browserify');
var Backbone = require('../lib/backbone');
var Raphael = require('raphael');


var OtpBikeTrianglePanel = Backbone.View.extend({
   
	cursor_size : 19,
    barWidth    : 0,
    tri_size    : 0,

    trianglequickFactor:    null,
    triangleflatFactor:   null,
    trianglesafeFactor:  null,

    // default is even mixture 
    quickFactor : 0.333,
    flatFactor  : 0.333,
    safeFactor  : 0.334,

    onChanged   : null,
    
    quickBar    : null,
    flatBar     : null,
    safeBar     : null,

    quickLabel  : null,
    flatLabel   : null,
    safeLabel   : null,
    
    cursorVert  : null,
    cursorHoriz : null,
    cursor      : null,

    quickName   : "Quick",
    flatName    : "Flat",
    safeName    : "Bike Friendly",

    initialize : function() {

        this.render();
    },
    
    render : function() {
    
        var this_ = this;
   
        var width = this.$el.width(), height = this.$el.height();
        var tri_side = 2 * (height - this.cursor_size) * 1/Math.sqrt(3);
        this.tri_side = tri_side;
        var margin = this.cursor_size/2;	
        
        //console.log()

        var canvas = Raphael(this.$el.attr('id'), width, height);

        var bg = canvas.rect(0,0,width,height).attr({
              stroke: 'none',
              fill: 'none'
          });

        var triangle = canvas.path(["M",margin+tri_side/2,margin,"L",margin+tri_side,height-margin,"L",margin,height-margin,"z"]);


        triangle.attr({fill:"#fff", stroke:"#aaa"});
        
        var labelSize = "18px";

        var safeFill = "#bbe070"; 
        var safeFill2 = "#77b300"; 
        var safeSym  = "B"; //locale.bikeTriangle.safeSym;

        var flatFill = "#8cc4ff"; 
        var flatFill2 = "#61a7f2"; 
        var flatSym  = "F"; //locale.bikeTriangle.flatSym;
        
        var quickFill = "#ffb2b2";
        var quickFill2 = "#f27979";
        var quickSym  = "Q"; //locale.bikeTriangle.quickSym;

        var labelT = canvas.text(margin + tri_side/2, margin+24, quickSym);
        labelT.attr({fill:quickFill2, "font-size":labelSize, "font-weight":"bold"});	

        var labelH = canvas.text(margin + 22, height-margin-14, flatSym);
        labelH.attr({fill:flatFill2, "font-size":labelSize, "font-weight":"bold"});	

        var labelS = canvas.text(margin + tri_side - 22, height-margin-14, safeSym);
        labelS.attr({fill:safeFill2, "font-size":labelSize, "font-weight":"bold"});	

        var barLeft = margin*2 + tri_side; 
        this.barWidth = width - margin*3 - tri_side;
        var barWidth = this.barWidth;
        var barHeight = (height-margin*4)/3;

        this.quickBar = canvas.rect(barLeft, margin, barWidth*.333, barHeight);
        this.quickBar.attr({fill:quickFill, stroke:"none"});

        this.flatBar = canvas.rect(barLeft, margin*2+barHeight, barWidth*.333, barHeight);
        this.flatBar.attr({fill:flatFill, stroke:"none"});

        this.safeBar = canvas.rect(barLeft, margin*3 + barHeight*2, barWidth*.333, barHeight);
        this.safeBar.attr({fill:safeFill, stroke:"none"});

        this.quickLabel = canvas.text(barLeft + margin, margin+barHeight/2, this.quickName + ": 33%");
        this.quickLabel.attr({"font-size":"13px", "text-anchor" : "start",  opacity:1});

        this.flatLabel = canvas.text(barLeft + margin, margin*2+barHeight+barHeight/2,  this.flatName + ": 33%");
        this.flatLabel.attr({"font-size":"13px", "text-anchor" : "start", opacity:1});

        this.safeLabel = canvas.text(barLeft + margin, margin*3+barHeight*2+barHeight/2, this.safeName + ": 33%");
        this.safeLabel.attr({"font-size":"13px", "text-anchor" : "start", opacity:1});

        var cx = margin+tri_side/2, cy = height-margin-(1/Math.sqrt(3))*(tri_side/2);
        this.cursorVert = canvas.rect(cx-.5, cy-this.cursor_size/2-2, 1, this.cursor_size+4).attr({
            fill: "rgb(0,0,0)",
            stroke: "none"
        });
        this.cursorHoriz = canvas.rect(cx-this.cursor_size/2-2, cy-.5, this.cursor_size+4, 1).attr({
            fill: "rgb(0,0,0)",
            stroke: "none"
        });
        this.cursor = canvas.circle(cx, cy, this.cursor_size/2).attr({
            fill: "rgb(128,128,128)",
            stroke: "none",
            opacity: 0.25
        });
            
        var time, topo, safety;

        var this_ = this;
        var animTime = 250;
        var start = function () {
            // storing original coordinates
            this.ox = this.attr("cx");
            this.oy = this.attr("cy");
            this_.quickBar.animate({opacity: .25}, animTime);
            this_.flatBar.animateWith(this_.quickBar, {opacity: .25}, animTime);
            this_.safeBar.animateWith(this_.quickBar, {opacity: .25}, animTime);
            //quickLabel.animate({opacity: 1}, animTime);
            //flatLabel.animate({opacity: 1}, animTime);
            //safeLabel.animate({opacity: 1}, animTime);
        },
        move = function (dx, dy) {
            // move will be called with dx and dy
            var nx = this.ox + dx, ny = this.oy + dy;
            if(ny >  height-margin) ny = height-margin;
            if(ny < margin) ny = margin;
            var offset =  (ny-margin)/(height-margin*2) * tri_side/2; 	
            if(nx < margin + (tri_side/2) - offset) nx = margin + (tri_side/2) - offset; 
            if(nx > margin + (tri_side/2) + offset) nx = margin + (tri_side/2) + offset;

            time = ((height-2*margin)-(ny-margin))/(height-2*margin);
            topo = this_.distToSegment(nx, ny, margin+tri_side/2, margin, margin+tri_side, height-margin)/(height-2*margin);
            safety = 1- time - topo;

            this_.quickBar.attr({width: barWidth*time});
            this_.flatBar.attr({width: barWidth*topo});
            this_.safeBar.attr({width: barWidth*safety});
            this_.quickLabel.attr("text", this_.quickName + ": "+Math.round(time*100)+"%");
            this_.flatLabel.attr("text", this_.flatName + ": " +Math.round(topo*100)+"%");
            this_.safeLabel.attr("text", this_.safeName + ": " +Math.round(safety*100)+"%");
    
            this_.moveCursor(nx, ny);
        },
        up = function () {
            // restoring state
            this_.quickBar.animate({opacity: 1}, animTime);
            this_.flatBar.animateWith(this_.quickBar, {opacity: 1}, animTime);
            this_.safeBar.animateWith(this_.quickBar, {opacity: 1}, animTime);
            //quickLabel.animate({opacity: 0}, animTime);
            //flatLabel.animate({opacity: 0}, animTime);
            //safeLabel.animate({opacity: 0}, animTime);

            // was seeing really odd small numbers in scientific notation when topo neared zero so added this
            if(topo < 0.005) {
                topo = 0.0;
            }
            
            this_.quickFactor = time;
            this_.flatFactor = topo;
            this_.safeFactor = safety;

            this_.updateModel();

            if(this_.onChanged && typeof(this_.onChanged) === "function") {
                this_.onChanged();
            }
        };

        this.cursor.drag(move, start, up);
        this.cursor.mouseover(function() {
            this.animate({opacity: 0.5}, animTime);
        });
        this.cursor.mouseout(function() {
            this.animate({opacity: 0.25}, animTime);
        });
        
    },

    updateModel: function() {
        this.model.set({'triangleSafetyFactor':  this.safeFactor, 'triangleSlopeFactor':  this.quickFactor, 'triangleTimeFactor':  this.flatFactor, 'optimize': 'TRIANGLE'});
        
    },
    
    moveCursor : function(x, y) {
        this.cursor.attr({cx: x, cy: y});
        this.cursorVert.attr({x: x-.5, y: y-this.cursor_size/2-2});
        this.cursorHoriz.attr({x: x-this.cursor_size/2-2, y: y-.5});
    },

    enable : function() {
          if(this.container.findById('trip-bike-triangle') == null) {
               this.container.add(this.panel);
          }
          this.panel.show();
          this.container.doLayout();
    },

    disable : function() {
        if(!this.panel.hidden) {
            this.panel.hide();
        }
    },

    distance : function(x1, y1, x2, y2) {
	     return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    },

    distToSegment : function(px, py, x1, y1, x2, y2) {
        var r, dx ,dy;
        dx = x2 - x1;
        dy = y2 - y1;
        r = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        return this.distance(px, py, (1 - r) * x1 + r * x2, (1 - r) * y1 + r * y2);
    },

    setValues : function(quick, flat, safe) {
        this.quickFactor = quick;
        this.flatFactor = flat;
        this.safeFactor = safe;
        
        this.quickBar.attr({width: this.barWidth*quick});
        this.flatBar.attr({width: this.barWidth*flat});
        this.safeBar.attr({width: this.barWidth*safe});
        this.quickLabel.attr("text",   this.quickName + ": "+Math.round(quick*100)+"%");
        this.flatLabel.attr("text",   this.flatName + ": " +Math.round(flat*100)+"%");
        this.safeLabel.attr("text", this.safeName + ": " +Math.round(safe*100)+"%");

        var margin = this.cursor_size/2;
        
        var x = margin + this.tri_side/2;
        var y = margin + this.tri_side / Math.sqrt(3);
        
        var qx = 0, qy = -this.tri_side / Math.sqrt(3);
        var fx = -this.tri_side/2, fy = (this.tri_side/2) / Math.sqrt(3);
        var sx = this.tri_side/2, sy = (this.tri_side/2) / Math.sqrt(3);
        
        x  = x + quick*qx + flat*fx + safe*sx;
        y  = y + quick*qy + flat*fy + safe*sy;
        
        this.moveCursor(x, y);

    }

});

module.exports.OtpBikeTrianglePanel = OtpBikeTrianglePanel;