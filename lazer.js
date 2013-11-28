LZ = {};
LZ.prototype = function LZ() {};

(function () {
	function Tile(obj) {
		this.tiles = [];
		this.rects = [];
		this.width = obj.width || 8;
		this.height = obj.height || 8;
		this.cells = obj.emptyCells || [];
		
		this.tileSize = obj.tileSize || size(50,50);
		this.renderAABB = function (ctx) {
			for (var x = 0; x < this.width; x++) {
				for (var y = 0; y < this.height; y++) {
					var tile = this.tiles[x][y];
					
					var xx = x * this.tileSize.w/2 + 70;
					var yy = y * this.tileSize.h/2 + 30;
					
					if (tile == 1) {
						ctx.save();
						ctx.translate(xx,yy);
						
						ctx.globalAlpha = 0.5;
						ctx.fillStyle = "#fff";
						ctx.font = "10px Arial";
						ctx.textAlign = "center";
						ctx.textBaseline = "middle";
						
						ctx.fillText("("+x+","+y+")",xx,yy);
						
						ctx.restore();
					}
				}
			} 
		};
		
		this.onEnter = function () {
			for (var x = 0; x < this.width; x++) {
				this.tiles[x] = [];
				
				for (var y = 0; y < this.height; y++) {
					this.tiles[x][y] = 1;
				}
			}
			
			if (this.cells.length > 0 && this.cells.length % 2 == 0) {
				for (var i = 0; i < this.cells.length; i++) {
					var x = this.cells[i];
					i++
					var y = this.cells[i];
					
					this.tiles[x][y] = 0;
				}
			}
			
			for (var x = 0; x < this.width; x++) {
				for (var y = 0; y < this.height; y++) {
					var tile = this.tiles[x][y];
					
					if (tile == 0) {
						var rect = new RJ.Rect(120 + x * this.tileSize.w,40 + y * this.tileSize.h,this.tileSize.w,this.tileSize.h);
						
						this.rects.push(rect);
					}
				}
			}
			
			this.gradF = RJ.RadialGradient(this.game,
				new RJ.Circle(vec2(this.tileSize.w/2,this.tileSize.h/2),1),
				new RJ.Circle(vec2(this.tileSize.w/2,this.tileSize.h/2),this.tileSize.w/2),[0,"#022",1,"#011"]);
		};
		
		this.render = function (ctx) {
			for (var x = 0; x < this.width; x++) {
				for (var y = 0; y < this.height; y++) {
					var tile = this.tiles[x][y];
					
					var xx = x * this.tileSize.w;
					var yy = y * this.tileSize.h;
					
					if (tile == 1) {
						ctx.save();
						ctx.translate(xx,yy);
						ctx.fillStyle = this.gradF;
						
						ctx.fillRect(0,0,this.tileSize.w,this.tileSize.h);
						ctx.strokeRect(0,0,this.tileSize.w,this.tileSize.h);
						ctx.restore();
					}
				}
			} 
		};
		
		RJ.inherit(this,Tile,RJ.GameObject,obj);
	}
	function Lazer(obj) {
		obj.pos = vec2(0,0);
		this.path = [];
		this.dir = obj.dir.unit();
		this.org = obj.org.clone();
		this.tile = obj.tiles || null;
		this.mirrors = obj.mirrors || null;
		this.detector = obj.detector || null;
		this.callback = obj.callback || null;
		
		this.prevDir = this.dir.clone();
		this.ang = 0;
		
		this.onEnter = function () {
			this.computePath();
			this.ang = vecNull().angleT(this.dir.clone())-Math.PI;
			
			this.game.mouseHandler.addHandler(this)
		};
		
		this.onExit = function () {
			this.game.mouseHandler.removeHandler(this)
		};
		
		this.computePath = function () {
			if (this.running) {
				var notInside = false;
				var i = 0;
			
				this.path = [];
				this.path[0] = this.org.clone();
			
				var lastMir = null;
				while (!notInside) {
					var org = this.path[i].clone();
					var dest = org.clone().add(this.prevDir);
				
					var delta = dest.clone().sub(org);
					if (delta.x == 0) {
						delta.x = 0.001;
					}
				
					var m = (delta.y/delta.x).toFixed(10);
					var y = org.y - m * org.x;
				
					var ofunc = function (x) {
						return m * x + y;
					}
				
					var func = function (x) {
						return (x - y)/m;
					}
				
					var x = 0;
					var yy = 0;
					var xx = (delta.y > 0) ? 440 : 40;
				
					var reflect = null;
					x = func(xx);
				
					if (x > 520) {
						yy = ofunc(520);
						x = func(yy);
						reflect = true;
					}
					else if (x < 120) {
						yy = ofunc(120);
						x = func(yy);
						reflect = true;
					}
					else {
						var yy = xx;
						reflect = false;
					}
				
					if (isNaN(x)) {
						x = (delta.x > 0) ? 520 : 120;
					}
				
					var colliding = false;
					var mirror = false;
					var pos = vec2(x,yy);
				
					var minDist = 1000 * 1000;
					var minRect = null;
				
					var line = {p1: org,p2: pos};
					for (var d = 0; d < this.tile.rects.length; d++) {
						var rect = this.tile.rects[d];
					
						if (rect.aabbToLine(line)) {
							colliding = true;
							mirror = false;
							var dist = (rect.x - org.x) * (rect.x - org.x) +
									   (rect.y - org.y) * (rect.y - org.y);
						
							if (dist < minDist) {
								minDist = dist;
								minRect = rect;
							}
						}
					}
				
					for (var d = 0; d < this.mirrors.mirrors.length; d++) {
						var mir = this.mirrors.mirrors[d];
					
						if (mir.rect.aabbToLine(line)) {
							var dist = (mir.rect.x - org.x) * (mir.rect.x - org.x) + (mir.rect.y - org.y) * (mir.rect.y - org.y);
						
							var cond = (dist < minDist) && ((lastMir == null) || (lastMir != null && !lastMir.rect.equal(mir.rect)));
							if (cond) {
								colliding = false;
							
								minDist = dist;
								minRect = mir;
								mirror = true;
								lastMir = mir;
							
								break;
							}
						}
					}
				
					var dist = (this.detector.pos.x - org.x) * (this.detector.pos.x - org.x) + (this.detector.pos.y - org.y) * (this.detector.pos.y - org.y);
					if (this.detector.rect.aabbToLine(line) && (!colliding || dist < minDist)) {
						// Do something: win point
						this.callback(i+1);
					}
				
					if (!colliding && !mirror) {
						if (reflect == true) {
							this.prevDir.x *= -1;
						}
						else if (reflect == false) {
							this.prevDir.y *= -1;
						}
					
						this.path.push(pos);
						i++;
					}
					else if (mirror) {
						this.prevDir = RJ.Vector.angleToVec(minRect.angle-Math.PI/2);
						x = minRect.pos.x;
						yy = minRect.pos.y;
					
						pos = vec2(x,yy);
						this.path.push(pos);
						i++;
					}
					else if (colliding) {
						xx = (delta.y > 0) ? minRect.min.y-1 : minRect.max.y+1;
					
						x = func(xx);
				
						if (x > minRect.max.x) {
							yy = ofunc(minRect.max.x+1);
							x = func(yy);
							this.prevDir.x *= -1;
						}
						else if (x < minRect.min.x) {
							yy = ofunc(minRect.min.x-1);
							x = func(yy);
							this.prevDir.x *= -1;
						}
						else {
							var yy = xx;
							this.prevDir.y *= -1;
						}
					
						pos = vec2(x,yy);
					
						this.path.push(pos);
						i++;
					}
				
					if ((!colliding && !mirror) || i > 15) {
						notInside = true;
					}
				}
			}
		};
		
		this.m = false
		this.mouseHandler = function (state,cur) {
			if (state == "down" && this.org.distance(cur) < 64 * 64) {
				this.m = true;
				
				this.ang = this.org.angleT(cur) + Math.PI;
				this.dir = RJ.Vector.angleToVec(this.ang);
				this.prevDir = this.dir.clone();
				this.computePath();
			}
			else if (state == "click") {
				this.m = false;
			}
			else if (state == "move" && this.m && this.org.distance(cur) < 64 * 64) {
				this.ang = this.org.angleT(cur) + Math.PI;
				this.dir = RJ.Vector.angleToVec(this.ang);
				this.prevDir = this.dir.clone();
				this.computePath();
			}
		};
		
		this.render = function (ctx) {
			ctx.globalAlpha = 0.5;
			ctx.lineWidth = 4;
			ctx.beginPath();
			
			ctx.arc(this.org.x,this.org.y,64,0,2*Math.PI,true)
			
			ctx.stroke();
			
			ctx.lineWidth = 2;
			ctx.globalAlpha = 1;
			ctx.beginPath();
			
			ctx.arc(this.org.x,this.org.y,6,0,2*Math.PI,true)
			
			ctx.stroke();
			
			// Red
			ctx.lineWidth = 4;
			for (var i = 0; i < this.path.length-1; i++) {
				var pos = this.path[i];
				var pos1 = this.path[i+1];
				
				ctx.beginPath();
			
				ctx.moveTo(pos.x,pos.y);
				ctx.lineTo(pos1.x,pos1.y)
			
				ctx.stroke();
			}
			
			//White
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.85;
			ctx.strokeStyle = "#fff";
			for (var i = 0; i < this.path.length-1; i++) {
				var pos = this.path[i];
				var pos1 = this.path[i+1];
				
				ctx.beginPath();
			
				ctx.moveTo(pos.x,pos.y);
				ctx.lineTo(pos1.x,pos1.y)
			
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			ctx.lineWidth = 4;
			ctx.strokeStyle = "#067";
			ctx.strokeRect(120,40,400,400);
		};
		
		RJ.inherit(this,Lazer,RJ.GameObject,obj);
	}
	function Mirrors(obj) {
		this.mirrors = [];
		this.radius = 40;
		this.poses = obj.mirrors || [];
		this.color = obj.color || "#f00";
		
		this.onEnter = function () {
			this.game.mouseHandler.addHandler(this);
			
			if (this.poses.length > 0) {
				for (var i = 0; i < this.poses.length; i++) {
					var pos = this.poses[i].clone().scalar(40).add(vec2(20,20));
					
					this.add(pos,0);
				}
			}
			
			this.lazer.prevDir = RJ.Vector.angleToVec(this.lazer.ang);
			this.lazer.computePath();
		};
		
		this.onExit = function () {
			this.game.mouseHandler.removeHandler(this)
		};
		
		this.m = false;
		this.mir = null;
		this.mouseHandler = function (state,cursor) {
			if (state == "down") {
				if (this.mirrors.length > 0) {
					for (var i = 0; i < this.mirrors.length; i++) {
						var mirror = this.mirrors[i];
						
						var dist = cursor.distance(mirror.pos);
						
						if (dist < this.radius*this.radius) {
							this.m = true;
							this.mir = mirror;
							
							this.mir.angle = this.mir.pos.angleT(cursor) - Math.PI/2;
							this.lazer.prevDir = RJ.Vector.angleToVec(this.lazer.ang)
							this.lazer.computePath();
						}
					}
				}
			}
			else if (state == "click") {
				this.m = false;
				this.mir = null;
			}
			else if (this.mir && state == "move" && this.m && this.mir.pos.distance(cursor) < this.radius * this.radius) {
				this.mir.angle = this.mir.pos.angleT(cursor) - Math.PI/2;
				this.lazer.prevDir = RJ.Vector.angleToVec(this.lazer.ang)
				this.lazer.computePath();
			}
		};
		
		this.render = function (ctx) {
			
			if (this.mirrors.length > 0) {
				for (var i = 0; i < this.mirrors.length; i++) {
					var mirror = this.mirrors[i];
					
					ctx.save();
					ctx.translate(mirror.pos.x,mirror.pos.y);
					ctx.rotate(mirror.angle);
					
					ctx.fillRect(-18,-3,36,6);
					ctx.strokeRect(-18,-3,36,6);
					
					ctx.lineWidth = 3;
					ctx.globalAlpha = 0.5;
					ctx.strokeStyle = this.color;
					ctx.beginPath();
					
					ctx.arc(0,0,this.radius,0,Math.PI * 2, true);
					
					ctx.stroke();
					
					ctx.restore();
				}
			}
		};
		
		this.add = function (pos,angle) {
			pos.x += 120;
			pos.y += 40;
			
			this.mirrors.push({
				pos: pos.clone(),
				angle: angle,
				rect: new RJ.Rect(pos.x-20,pos.y-20,40,40),
			});
		};
		
		RJ.inherit(this, Mirrors, RJ.GameObject, obj)
	}
	
	function Button(obj) {
		this.callback = obj.callback || null;
		this.image = obj.image || null;
		
		this.onEnter = function () {
			this.game.mouseHandler.addHandler(this);
			
			this.addChild(this.image);
		};
		
		this.onExit = function () {
			this.game.mouseHandler.removeHandler(this);
		};
		
		this.inside = false;
		this.mouseHandler = function (state,cur) {
			if (state == "down") {
				if (this.rect.containVec(cur)) {
					this.inside = true;
				}
			}
			else if (state == "click" && this.inside) {
				this.callback();
				
				this.inside = false;
			}
		};
		
		RJ.inherit(this,Button,RJ.GameObject,obj);
	}
	
	function LzDetector(obj) {
		this.circle = new RJ.Circle(obj.pos.clone(),obj.size.w/2);
		this.render = function (ctx) {
			ctx.fillRect(0,0,this.rect.w,this.rect.h);
			ctx.strokeRect(0,0,this.rect.w,this.rect.h);
		};
		
		this.onEnter = function () {
			
		};
		
		RJ.inherit(this, LzDetector, RJ.GameObject, obj);
	}
	
	function HowTo(obj) {
		this.image = obj.image || null;
		
		this.render = function (ctx) {
			if (this.image) {
				// Top
				ctx.drawImage(this.image,0,300,150,150,32,80,150,150);
				ctx.strokeRect(32,80,150,150);
				
				ctx.font = "12px Arial";
				ctx.textAlign = "left";
				ctx.textBaseline = "top";
				ctx.fillStyle = "#f0f";
				
				ctx.fillText("Click inside the source's area (big circle around colorful circle emitting laser)",192,80);
				ctx.fillText("and drag to change the angle of source emission. Direct the laser source toward",192,94);
				ctx.fillText("mirrors or walls (empty cells) to reflect the lasers.",192,108);
				
				// Middle
				ctx.drawImage(this.image,0,150,150,150,458,165,150,150);
				ctx.strokeRect(458,165,150,150);
				
				ctx.textBaseline = "middle";
				ctx.fillStyle = "#0f0";
				
				ctx.fillText("Click inside mirror's area (little circle around",192,226);
				ctx.fillText("gray rectangle) to change the direction of",192,240);
				ctx.fillText("laser reflection.",192,254);
				
				// Bottom
				ctx.drawImage(this.image,0,0,150,150,32,250,150,150);
				ctx.strokeRect(32,250,150,150);
				
				ctx.textBaseline = "bottom";
				ctx.fillStyle = "#0ff";
				
				ctx.fillText("Your target is to direct laser into the laser detector (gray rectangle),",192,386)
				ctx.fillText("try to use less reflections.",192,400)
			}
		};
		
		RJ.inherit(this, HowTo, RJ.GameObject, obj);
	}
	
	function LevelSelect(obj) {
		this.levels = obj.levels || null;
		this.callback = obj.callback || null;
		this.rects = [];
		this.page = 1;
		
		this.onEnter = function () {
			this.game.mouseHandler.addHandler(this);
			
			for (var i = 0; i < this.levels.length; i++) {
				var x = i % 3;
				var y = Math.floor(i/3)%2;
				
				x *= 180;
				x += 140;
				
				y *= 120;
				y += 220;
				
				this.rects.push(new RJ.Rect(x-80,y-40,160,80));
			}
			
			this.left = new RJ.Rect(600,190,40,100);
			this.right = new RJ.Rect(0,190,40,160);
		};
		
		this.onExit = function () {
			this.game.mouseHandler.removeHandler(this);
		};
		
		this.render = function (ctx) {
			ctx.font = "24px Verdana";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineWidth = 4;
			
			var d = this.page * 6;
			var s = (this.page-1) * 6;
			var l = this.levels.length;
			
			if (l < d) {
				l = s + (l%6);
			}
			else if (d < l) {
				l = d;
			}
			
			for (var i = s; i < l; i++) {
				var level = this.levels[i];
				
				if (level != undefined) {
					var bars = JSON.parse("["+localStorage.levels+"]")[i];
				
					var x = i % 3;
					var y = Math.floor(i/3)%2;
				
					x *= 180;
					x += 140;
				
					y *= 120;
					y += 220;
					
					ctx.fillStyle = "#023";
					ctx.strokeStyle = "#012";
					ctx.fillRect(x - 80,y - 40, 160,80);
					ctx.strokeRect(x - 80,y - 40, 160,80);
					ctx.fillStyle = "#fff";
					ctx.fillText("LEVEL "+(i+1),x,y-20);
				
					var h = bars;
					for (var d = 0; d < 3; d++) {
						if (h > 0) {
							ctx.fillStyle = "#034";
							ctx.fillRect(x - 50 + d * 40,y,20,30);
						
							h--;
						}
						else {
							ctx.fillStyle = "#067";
							ctx.fillRect(x - 50 + d * 40,y,20,30);
							ctx.fillStyle = "#034";
							ctx.fillRect(x - 50 + d * 40,y+20,20,10);
						}
						ctx.strokeRect(x - 50 + d * 40,y,20,30);
					}
				}
				
				if (this.page*6 < this.levels.length) {
					ctx.fillStyle = "#023";
					ctx.strokeStyle = "#034";
					ctx.fillRect(600,190,40,100);
					ctx.strokeRect(600,190,40,100);
					
					ctx.strokeStyle = "#bbb";
					ctx.fillStyle = "#fff";
					ctx.beginPath();
					
					ctx.moveTo(610,240-30);
					ctx.lineTo(610,240+30);
					ctx.lineTo(630,240);
					
					ctx.closePath();
					ctx.fill();
					ctx.stroke();
				}
				
				if (this.page > 1) {
					ctx.fillStyle = "#023";
					ctx.strokeStyle = "#034";
					ctx.fillRect(0,190,40,100);
					ctx.strokeRect(0,190,40,100);
					
					ctx.strokeStyle = "#bbb";
					ctx.fillStyle = "#fff";
					ctx.beginPath();
					
					ctx.moveTo(30,240-30);
					ctx.lineTo(30,240+30);
					ctx.lineTo(10,240);
					
					ctx.closePath();
					ctx.fill();
					ctx.stroke();
				}
			}	
		};
		
		this.mouseHandler = function (state, cur) {
			if (state == "down") {
				var d = this.page * 6;
				var s = (this.page-1) * 6;
				var l = this.levels.length;
			
				if (l < d) {
					l = s + (l%6);
				}
			
				for (var i = s; i < l; i++) {
					var rect = this.rects[i];
					
					if (rect.containVec(cur)) {
						this.callback(i);
						
						break;
						return;
					}
				}
				
				if (this.left.containVec(cur) && this.page*6 < this.levels.length) {
					this.page ++;
				}
				
				if (this.right.containVec(cur) && this.page > 1) {
					this.page --;
				}
			}
		};
		
		RJ.inherit(this, LevelSelect, RJ.GameObject, obj);
	}
	
	LZ.Tile = Tile;
	LZ.Lazer = Lazer;
	LZ.Mirrors = Mirrors;
	LZ.Button = Button;
	LZ.LzDetector = LzDetector;
	LZ.HowTo = HowTo;
	LZ.LevelSelect = LevelSelect;
})();