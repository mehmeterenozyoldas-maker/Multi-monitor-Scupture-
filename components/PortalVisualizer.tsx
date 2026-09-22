import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import { WindowState, WorldBounds, AppEvent } from '../types';
import { 
  PARTICLE_COUNT, 
  RING_RADIUS_BASE, 
  STAR_COUNT,
  TRAIL_LENGTH,
  GRID_SIZE,
  NEBULA_COUNT,
  COLOR_PRIMARY_HUE,
  COLOR_SECONDARY_HUE,
  COLOR_ACCENT_HUE,
  COLOR_BACKGROUND
} from '../constants';

interface PortalVisualizerProps {
  peersRef: React.MutableRefObject<Map<string, WindowState>>;
  eventQueueRef: React.MutableRefObject<AppEvent[]>;
  getSelfState: () => WindowState;
  broadcastEvent: (event: AppEvent) => void;
}

export const PortalVisualizer: React.FC<PortalVisualizerProps> = ({ 
    peersRef, 
    getSelfState, 
    eventQueueRef, 
    broadcastEvent 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      interface Point { x: number, y: number }
      
      interface Particle {
        angle: number;
        radius: number;
        speed: number;
        size: number;
        baseHue: number;
        z: number;
        history: Point[];
      }
      
      interface Star {
        x: number;
        y: number;
        z: number;
        size: number;
      }

      interface Nebula {
        x: number;
        y: number;
        size: number;
        hue: number;
        offset: number;
      }

      interface ActiveShockwave {
        x: number;
        y: number;
        startTime: number;
        id: string;
      }

      const particles: Particle[] = [];
      const stars: Star[] = [];
      const nebulaClouds: Nebula[] = [];
      let activeShockwaves: ActiveShockwave[] = [];

      p.setup = () => {
        p.createCanvas(window.innerWidth, window.innerHeight);
        p.colorMode(p.HSB, 360, 100, 100, 100);
        p.frameRate(60);
        
        // Initialize Particles with History
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push({
            angle: p.random(p.TWO_PI),
            radius: p.random(RING_RADIUS_BASE * 0.2, RING_RADIUS_BASE * 2.5),
            speed: p.random(0.002, 0.008) * (Math.random() > 0.5 ? 1 : -1),
            size: p.random(1.5, 4),
            baseHue: Math.random() > 0.7 ? COLOR_ACCENT_HUE : (Math.random() > 0.5 ? COLOR_PRIMARY_HUE : COLOR_SECONDARY_HUE),
            z: p.random(0.5, 1.5),
            history: []
          });
        }

        // Initialize Stars
        const range = 4000;
        for (let i = 0; i < STAR_COUNT; i++) {
          stars.push({
            x: p.random(-range, range),
            y: p.random(-range, range),
            z: p.random(0.2, 5),
            size: p.random(1, 4)
          });
        }

        // Initialize Nebula Clouds
        for (let i = 0; i < NEBULA_COUNT; i++) {
            nebulaClouds.push({
                x: p.random(-1000, 1000),
                y: p.random(-1000, 1000),
                size: p.random(800, 2000),
                hue: p.random(COLOR_SECONDARY_HUE - 20, COLOR_SECONDARY_HUE + 20),
                offset: p.random(1000)
            });
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
      };

      p.mousePressed = () => {
          // Trigger a shockwave at the mouse position (converted to world coords)
          const self = getSelfState();
          
          // Current mouse relative to window
          const mx = p.mouseX;
          const my = p.mouseY;
          
          // Convert to world space
          // Window X/Y are screen coordinates. 
          // World Mouse X = Window Screen X + local Mouse X
          const worldX = self.x + mx;
          const worldY = self.y + my;
          
          broadcastEvent({
              type: 'SHOCKWAVE',
              x: worldX,
              y: worldY,
              timestamp: Date.now(),
              originId: self.id
          });
      };

      const calculateWorldBounds = (): WorldBounds => {
        const self = getSelfState();
        const allPeers: WindowState[] = Array.from(peersRef.current.values());
        
        if (allPeers.length === 0) {
          return {
            minX: self.x,
            maxX: self.x + self.w,
            minY: self.y,
            maxY: self.y + self.h,
            centerX: self.x + self.w / 2,
            centerY: self.y + self.h / 2,
            width: self.w,
            height: self.h
          };
        }

        allPeers.push(self);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        allPeers.forEach(peer => {
          minX = Math.min(minX, peer.x);
          maxX = Math.max(maxX, peer.x + peer.w);
          minY = Math.min(minY, peer.y);
          maxY = Math.max(maxY, peer.y + peer.h);
        });

        return {
          minX, maxX, minY, maxY,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: maxX - minX,
          height: maxY - minY
        };
      };

      // --- Draw Hexagonal Grid ---
      const drawHexGrid = (offsetX: number, offsetY: number, excitement: number) => {
        p.push();
        p.strokeWeight(1);
        const alpha = 5 + excitement * 10;
        p.stroke(COLOR_PRIMARY_HUE, 60, 80, alpha);
        p.noFill();

        const hexH = GRID_SIZE;
        const hexW = Math.sqrt(3) * hexH;
        const spacingX = hexW;
        const spacingY = hexH * 1.5;

        // Calculate start/end based on screen to minimize draw calls
        const startCol = Math.floor((-offsetX - p.width/2) / spacingX) - 1;
        const endCol = Math.floor((-offsetX + p.width * 1.5) / spacingX) + 1;
        const startRow = Math.floor((-offsetY - p.height/2) / spacingY) - 1;
        const endRow = Math.floor((-offsetY + p.height * 1.5) / spacingY) + 1;

        for (let col = startCol; col <= endCol; col++) {
            for (let row = startRow; row <= endRow; row++) {
                const x = col * spacingX + (row % 2) * (spacingX / 2) + offsetX;
                const y = row * spacingY + offsetY;
                
                // Draw Hexagon
                p.beginShape();
                for (let i = 0; i < 6; i++) {
                    const angle = p.TWO_PI / 6 * i;
                    const hx = x + p.cos(angle) * (hexH * 0.58); // 0.58 makes it slightly detached
                    const hy = y + p.sin(angle) * (hexH * 0.58);
                    p.vertex(hx, hy);
                }
                p.endShape(p.CLOSE);
            }
        }
        p.pop();
      };

      const drawLightning = (x1: number, y1: number, x2: number, y2: number, intensity: number, time: number) => {
        const dist = p.dist(x1, y1, x2, y2);
        const steps = Math.floor(dist / 15);
        if (steps < 2) return;

        p.push();
        p.noFill();
        p.strokeCap(p.ROUND);
        
        // Outer Glow
        p.strokeWeight(6 + intensity * 8);
        p.stroke(COLOR_PRIMARY_HUE, 70, 90, 15 * intensity);
        
        const drawLine = (amp: number) => {
            p.beginShape();
            p.vertex(x1, y1);
            for(let i = 1; i < steps; i++) {
                const t = i / steps;
                const lx = p.lerp(x1, x2, t);
                const ly = p.lerp(y1, y2, t);
                
                // Envelope function to keep ends anchored
                const env = Math.sin(t * Math.PI); 
                const noiseVal = (p.noise(i * 0.3, time * 8) - 0.5) * amp * env;
                const noiseVal2 = (p.noise(i * 0.3 + 50, time * 8) - 0.5) * amp * env;
                
                p.vertex(lx + noiseVal, ly + noiseVal2);
            }
            p.vertex(x2, y2);
            p.endShape();
        };

        // Draw Glow
        drawLine(40 * intensity);

        // Inner Core
        p.strokeWeight(1.5 + intensity * 2);
        p.stroke(COLOR_ACCENT_HUE, 10, 100, 90);
        drawLine(20 * intensity);
        
        p.pop();
      };

      p.draw = () => {
        const time = Date.now() * 0.001;
        const nowMs = Date.now();
        const self = getSelfState();
        const bounds = calculateWorldBounds();
        const peers: WindowState[] = Array.from(peersRef.current.values());

        // Process Event Queue
        while(eventQueueRef.current.length > 0) {
            const ev = eventQueueRef.current.shift();
            if (ev && ev.type === 'SHOCKWAVE') {
                activeShockwaves.push({
                    x: ev.x,
                    y: ev.y,
                    startTime: nowMs,
                    id: ev.originId
                });
            }
        }
        
        // Clean up old shockwaves (live for 2 seconds)
        activeShockwaves = activeShockwaves.filter(sw => nowMs - sw.startTime < 2000);

        // Center calculation
        const localCenterX = bounds.centerX - self.x;
        const localCenterY = bounds.centerY - self.y;
        const myCenterX = self.w / 2;
        const myCenterY = self.h / 2;

        // --- Proximity & Excitement ---
        let closestDist = Infinity;
        peers.forEach(peer => {
            const peerLocalCX = (peer.x + peer.w / 2) - self.x;
            const peerLocalCY = (peer.y + peer.h / 2) - self.y;
            const d = p.dist(myCenterX, myCenterY, peerLocalCX, peerLocalCY);
            if(d < closestDist) closestDist = d;
        });

        let excitement = p.map(closestDist, 300, 1200, 1, 0, true);
        if (peers.length === 0) excitement = 0;
        
        // Intro animation ramp up
        const uptime = p.millis() / 1000;
        const introScale = p.min(uptime / 1.5, 1);
        
        const globalAngle = time * 0.5;

        // --- BACKGROUND RENDER ---
        p.background(COLOR_BACKGROUND, 40, 5, 100); // Dark void

        // 1. Nebula Clouds (Volumetric fog)
        p.push();
        p.noStroke();
        p.translate(localCenterX, localCenterY);
        p.rotate(globalAngle * 0.05);
        nebulaClouds.forEach((cloud, i) => {
            const pulse = p.sin(time * 0.5 + cloud.offset) * 0.2;
            const size = cloud.size * (1 + pulse);
            p.fill(cloud.hue, 60, 20, 3 + excitement * 2);
            // Simple circular clouds for performance, heavily blurred by low alpha
            p.ellipse(cloud.x, cloud.y, size, size * 0.8);
        });
        p.pop();

        // 2. Hex Grid
        // Move grid opposite to window movement to create feeling of shared space
        drawHexGrid(localCenterX % (Math.sqrt(3)*GRID_SIZE), localCenterY % (GRID_SIZE*1.5), excitement);

        // 3. Stars (Parallax)
        p.push();
        p.noStroke();
        stars.forEach(star => {
          const parallaxX = (self.x - bounds.centerX) * (0.1 / star.z);
          const parallaxY = (self.y - bounds.centerY) * (0.1 / star.z);
          const renderX = localCenterX + star.x - parallaxX;
          const renderY = localCenterY + star.y - parallaxY;

          // Culling
          if (renderX > -50 && renderX < p.width + 50 && renderY > -50 && renderY < p.height + 50) {
            const flicker = p.noise(star.x, time) * 50 + 50;
            const size = (star.size / star.z) * (1 + excitement);
            p.fill(220, 10, 100, flicker * 0.8);
            p.ellipse(renderX, renderY, size);
          }
        });
        p.pop();

        // 4. Electric Arcs (Peers)
        p.push();
        p.blendMode(p.ADD);
        peers.forEach(peer => {
            const peerLocalCenterX = (peer.x + peer.w / 2) - self.x;
            const peerLocalCenterY = (peer.y + peer.h / 2) - self.y;
            drawLightning(myCenterX, myCenterY, peerLocalCenterX, peerLocalCenterY, excitement, time);
        });
        p.pop();

        // --- 5. SHOCKWAVES (Interaction) ---
        p.push();
        p.noFill();
        p.strokeWeight(2);
        activeShockwaves.forEach(sw => {
            const age = nowMs - sw.startTime;
            const radius = age * 1.5; // Expansion speed
            const alpha = p.map(age, 0, 1500, 1, 0, true);
            
            // Convert world shockwave coord to local screen coord
            const swLocalX = sw.x - self.x;
            const swLocalY = sw.y - self.y;

            p.stroke(COLOR_PRIMARY_HUE, 0, 100, alpha * 100);
            p.ellipse(swLocalX, swLocalY, radius * 2);
            
            // Secondary ring
            p.stroke(COLOR_ACCENT_HUE, 80, 100, alpha * 50);
            p.ellipse(swLocalX, swLocalY, radius * 1.8);
        });
        p.pop();


        // --- 6. THE SINGULARITY (Core) ---
        p.push();
        p.translate(localCenterX, localCenterY);
        p.blendMode(p.ADD);

        // PULSATION LOGIC:
        const pulseSpeed = 2 + (excitement * 4); // Pulse gets manic when close
        const rawPulse = p.sin(globalAngle * pulseSpeed); 
        
        // Map pulse for Radius (Expansion)
        const radiusPulse = p.map(rawPulse, -1, 1, 0.8, 1.2);
        
        // Map pulse for Alpha (Fade) - peak alpha at peak radius
        const alphaPulse = p.map(rawPulse, -1, 1, 0.4, 1.0);

        // Map pulse for Color Shift (shift to warm at peak)
        const colorShift = p.map(rawPulse, 0.5, 1, 0, 1, true); 

        const baseR = RING_RADIUS_BASE * introScale * radiusPulse;
        
        p.noFill();
        const rings = 12; // More rings for spirograph density

        for(let i = 0; i < rings; i++) {
            const progress = i / rings;
            const baseCol = p.color(p.lerp(COLOR_PRIMARY_HUE, COLOR_SECONDARY_HUE, progress));
            const warmCol = p.color(COLOR_ACCENT_HUE, 90, 100);
            const mixAmt = colorShift * (0.5 + 0.5 * excitement);
            const finalCol = p.lerpColor(baseCol, warmCol, mixAmt);
            const finalAlpha = (80 - progress * 60) * alphaPulse + (excitement * 20);
            
            finalCol.setAlpha(finalAlpha);
            p.stroke(finalCol);
            
            p.strokeWeight(1.5 + (excitement * 1.5));
            
            p.beginShape();
            const loops = 180;
            for(let j = 0; j <= loops; j++) {
                const theta = (j / loops) * p.TWO_PI;
                const freqA = 3;
                const freqB = 2 + excitement;
                const phase = globalAngle * (1 - progress * 0.5);
                
                const r = baseR * (1 - progress * 0.4);
                const x = r * p.cos(theta * freqA + phase) + (r * 0.3) * p.cos(theta * freqB * 5 + phase);
                const y = r * p.sin(theta * freqA + phase) + (r * 0.3) * p.sin(theta * freqB * 5 + phase);
                p.vertex(x, y);
            }
            p.endShape(p.CLOSE);
        }
        
        // Inner Core Glow
        const coreGlowSize = baseR * 0.2 * (1 + rawPulse * 0.2);
        p.noStroke();
        p.fill(p.lerpColor(p.color(COLOR_PRIMARY_HUE, 80, 100), p.color(COLOR_ACCENT_HUE, 80, 100), colorShift));
        p.drawingContext.shadowBlur = 40;
        p.drawingContext.shadowColor = p.color(COLOR_ACCENT_HUE, 100, 100).toString();
        p.ellipse(0, 0, coreGlowSize, coreGlowSize);
        p.drawingContext.shadowBlur = 0;

        // 7. Particles (Magnetic + Trails + Shockwaves)
        const mouseInteractions = [
            { x: self.mouseX - bounds.centerX, y: self.mouseY - bounds.centerY, isRemote: false },
            ...peers.map(peer => ({ x: peer.mouseX - bounds.centerX, y: peer.mouseY - bounds.centerY, isRemote: true }))
        ];
        
        // Process active shockwaves relative to center
        const activeShockwavesForParticles = activeShockwaves.map(sw => ({
            x: sw.x - bounds.centerX,
            y: sw.y - bounds.centerY,
            radius: (nowMs - sw.startTime) * 1.5
        }));

        particles.forEach((pt, i) => {
            // Physics
            pt.angle += pt.speed * (1 + excitement);
            let rad = pt.radius;
            let px = p.cos(pt.angle) * rad;
            let py = p.sin(pt.angle) * rad * 0.6; // Elliptical orbit default

            // Magnetic Pull & Shockwave Logic
            let isAffected = false;
            let isAffectedByRemote = false;
            let hitByShockwave = false;
            
            let pullX = 0;
            let pullY = 0;

            const influenceRange = 500 + (excitement * 300);
            
            mouseInteractions.forEach(m => {
                const d = p.dist(px, py, m.x, m.y);
                if (d < influenceRange) {
                    isAffected = true;
                    if (m.isRemote) isAffectedByRemote = true;
                    
                    const force = p.map(d, 0, influenceRange, 15, 0);
                    const angleToMouse = p.atan2(m.y - py, m.x - px);
                    
                    // Spiraling attraction
                    pullX += p.cos(angleToMouse) * force;
                    pullY += p.sin(angleToMouse) * force;
                    pullX += p.cos(angleToMouse + p.HALF_PI) * force * 0.5;
                    pullY += p.sin(angleToMouse + p.HALF_PI) * force * 0.5;
                }
            });
            
            // Shockwave Push
            let shockwaveForceX = 0;
            let shockwaveForceY = 0;
            
            activeShockwavesForParticles.forEach(sw => {
                const d = p.dist(px, py, sw.x, sw.y);
                const distFromRing = Math.abs(d - sw.radius);
                
                // If particle is near the expanding ring
                if (distFromRing < 100) {
                    hitByShockwave = true;
                    const forceAmt = p.map(distFromRing, 0, 100, 30, 0); // Strong push
                    const angleFromCenter = p.atan2(py - sw.y, px - sw.x);
                    
                    shockwaveForceX += p.cos(angleFromCenter) * forceAmt;
                    shockwaveForceY += p.sin(angleFromCenter) * forceAmt;
                }
            });

            if (isAffected) {
                px += pullX;
                py += pullY;
            }
            
            if (hitByShockwave) {
                px += shockwaveForceX;
                py += shockwaveForceY;
            }

            // Update History for Trails
            if (p.frameCount % 2 === 0) { // Update trails every other frame for performance
                pt.history.push({ x: px, y: py });
                if (pt.history.length > TRAIL_LENGTH) {
                    pt.history.shift();
                }
            }

            // Render Trails
            if (pt.history.length > 2) {
                p.noFill();
                
                // Enhanced trails for shockwaves
                const swMultiplier = hitByShockwave ? 2.5 : 1;
                p.strokeWeight(pt.size * 0.5 * swMultiplier);
                
                let trailAlpha = (isAffected || hitByShockwave) ? 80 : 40;
                if (hitByShockwave) trailAlpha = 100;
                
                // Color Logic for Trails
                if (hitByShockwave) {
                    p.stroke(COLOR_PRIMARY_HUE, 0, 100, trailAlpha); // White/Bright trails for shock
                } else if (isAffectedByRemote) {
                    p.stroke(COLOR_SECONDARY_HUE, 80, 100, trailAlpha); // Purple trails for remote interactions
                } else {
                    p.stroke(pt.baseHue, 60, 100, trailAlpha);
                }
                
                p.beginShape();
                pt.history.forEach(h => p.vertex(h.x, h.y));
                p.vertex(px, py);
                p.endShape();
            }

            // Render Particle Head
            p.noStroke();
            let pColor = p.color(pt.baseHue, 70, 100);
            
            if (isAffected) pColor = p.lerpColor(pColor, p.color(COLOR_ACCENT_HUE, 0, 100), 0.8);
            if (isAffectedByRemote) pColor = p.lerpColor(pColor, p.color(COLOR_SECONDARY_HUE, 50, 100), 0.8);
            if (hitByShockwave) pColor = p.color(0, 0, 100); // White flash on shockwave hit
            
            // Pulse size based on angle to create "shimmer" ring effect
            const particlePulse = p.sin(globalAngle * 4 + i);
            const pAlpha = 60 + 40 * particlePulse;
            
            pColor.setAlpha(pAlpha);
            p.fill(pColor);
            
            const pSize = pt.size * (1 + (isAffected ? 1 : 0) + (hitByShockwave ? 2 : 0));
            p.ellipse(px, py, pSize);
        });

        p.pop(); // End Singularity Space

        // --- 8. Render Cursors (Interaction Feedback) ---
        p.push();
        p.blendMode(p.ADD);
        
        // Render Remote Cursors
        mouseInteractions.forEach(m => {
            if (m.isRemote) {
                // Convert world-relative coordinate back to local screen space
                // m.x is relative to World Center.
                // We need to draw at local coordinates.
                // Local Draw X = (m.x + bounds.centerX) - self.x
                // Wait, m.x was stored as (peer.mouseX - bounds.centerX)
                // So (m.x + bounds.centerX) restores the world coordinate.
                // Then subtract self.x to get local screen coord.
                
                const cursorWorldX = m.x + bounds.centerX;
                const cursorWorldY = m.y + bounds.centerY;
                const cursorScreenX = cursorWorldX - self.x;
                const cursorScreenY = cursorWorldY - self.y;

                // Draw Cursor Glow
                p.noStroke();
                p.fill(COLOR_SECONDARY_HUE, 60, 100, 30);
                p.ellipse(cursorScreenX, cursorScreenY, 60); // Outer glow
                p.fill(COLOR_SECONDARY_HUE, 20, 100, 80);
                p.ellipse(cursorScreenX, cursorScreenY, 12); // Core
                
                // Draw connecting line to center if hovering
                p.strokeWeight(1);
                p.stroke(COLOR_SECONDARY_HUE, 50, 100, 20);
                p.line(cursorScreenX, cursorScreenY, localCenterX, localCenterY);
            }
        });
        
        // Draw Local Cursor (Subtle indication)
        p.noStroke();
        p.fill(COLOR_PRIMARY_HUE, 60, 100, 15);
        p.ellipse(p.mouseX, p.mouseY, 50);

        p.pop();

        // --- 9. Post Processing: Scanlines & Vignette ---
        p.blendMode(p.BLEND);
        
        // CRT Scanlines
        p.fill(0, 0, 0, 20);
        p.noStroke();
        for (let y = 0; y < p.height; y += 4) {
            p.rect(0, y, p.width, 1);
        }

        // Vignette
        const gradient = p.drawingContext.createRadialGradient(p.width/2, p.height/2, p.width/3, p.width/2, p.height/2, p.width);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        p.drawingContext.fillStyle = gradient;
        p.rect(0, 0, p.width, p.height);

      };
    };

    const myP5 = new p5(sketch, containerRef.current);

    return () => {
      myP5.remove();
    };
  }, [getSelfState, peersRef, broadcastEvent, eventQueueRef]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};