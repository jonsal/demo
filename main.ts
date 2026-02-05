// Ball class to represent a bouncing ball
class Ball {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;

    constructor(x: number, y: number, vx: number, vy: number, radius: number, color: string) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.color = color;
    }

    // Update ball position
    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    // Draw the ball on the canvas
    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// Simulation class
class BouncingBallsSimulation {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    centerX: number;
    centerY: number;
    circleRadius: number;
    balls: Ball[];
    collisionPairs: Set<string>;
    previousCollisionPairs: Set<string>;
    collisionCooldown: Map<string, number>;
    frameCount: number;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error(`Canvas with id "${canvasId}" not found`);
        }
        
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;

        // Set up circular boundary
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.circleRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - 20;

        // Initialize two balls with random positions and velocities
        this.balls = [
            new Ball(
                this.centerX - 100,
                this.centerY - 50,
                2 + Math.random() * 2,
                1 + Math.random() * 2,
                20,
                '#ff6b6b'
            ),
            new Ball(
                this.centerX + 100,
                this.centerY + 50,
                -2 - Math.random() * 2,
                -1 - Math.random() * 2,
                20,
                '#4ecdc4'
            )
        ];

        // Track collision pairs to avoid duplicate spawns
        this.collisionPairs = new Set();
        this.previousCollisionPairs = new Set();
        this.collisionCooldown = new Map();
        this.frameCount = 0;
    }

    // Generate a random color
    getRandomColor(): string {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b',
            '#eb4d4b', '#6c5ce7', '#a29bfe', '#00b894', '#00cec9',
            '#fd79a8', '#fdcb6e', '#e17055', '#74b9ff', '#55efc4'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Spawn a new ball at the collision point
    spawnNewBall(x: number, y: number) {
        // Random velocity
        const speed = 1 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Random color
        const color = this.getRandomColor();

        // Ensure the new ball is inside the circular boundary
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = this.circleRadius - 20; // 20 is ball radius
        
        let spawnX = x;
        let spawnY = y;
        
        if (distance > maxDistance) {
            // Move spawn point inside boundary
            const angle = Math.atan2(dy, dx);
            spawnX = this.centerX + Math.cos(angle) * maxDistance;
            spawnY = this.centerY + Math.sin(angle) * maxDistance;
        }

        // Create new ball
        const newBall = new Ball(spawnX, spawnY, vx, vy, 20, color);
        this.balls.push(newBall);
        console.log(`Created ball at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}) with velocity (${vx.toFixed(2)}, ${vy.toFixed(2)})`);
    }

    // Check and handle collision with circular boundary
    checkBoundaryCollision(ball: Ball) {
        const dx = ball.x - this.centerX;
        const dy = ball.y - this.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = this.circleRadius - ball.radius;

        if (distance > maxDistance) {
            // Calculate normal vector (from center to ball)
            const normalX = dx / distance;
            const normalY = dy / distance;

            // Move ball back inside boundary
            ball.x = this.centerX + normalX * maxDistance;
            ball.y = this.centerY + normalY * maxDistance;

            // Reflect velocity along the normal
            const dotProduct = ball.vx * normalX + ball.vy * normalY;
            ball.vx -= 2 * dotProduct * normalX;
            ball.vy -= 2 * dotProduct * normalY;

            // Add some damping to prevent infinite bouncing
            ball.vx *= 0.98;
            ball.vy *= 0.98;
        }
    }

    // Check and handle collision between two balls
    checkBallCollision(ball1: Ball, ball2: Ball, ball1Index: number, ball2Index: number): boolean {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball1.radius + ball2.radius;

        if (distance < minDistance && distance > 0) {
            // Create a unique key for this collision pair
            const pairKey = `${Math.min(ball1Index, ball2Index)}-${Math.max(ball1Index, ball2Index)}`;
            
            // Calculate collision normal
            const normalX = dx / distance;
            const normalY = dy / distance;

            // Calculate relative velocity
            const relativeVx = ball2.vx - ball1.vx;
            const relativeVy = ball2.vy - ball1.vy;

            // Calculate relative velocity along collision normal
            const velocityAlongNormal = relativeVx * normalX + relativeVy * normalY;

            // Debug: log ALL collisions (first few only to avoid spam)
            if (this.frameCount < 300 || (this.frameCount % 120 === 0 && distance < minDistance * 0.9)) {
                console.log(`[Frame ${this.frameCount}] Overlap detected: balls ${ball1Index} & ${ball2Index}, distance: ${distance.toFixed(1)}, velAlongNormal: ${velocityAlongNormal.toFixed(3)}`);
            }

            // Check cooldown - only spawn if enough frames have passed since last spawn for this pair
            const lastSpawnFrame = this.collisionCooldown.get(pairKey) || -1000;
            const framesSinceLastSpawn = this.frameCount - lastSpawnFrame;
            const canSpawn = framesSinceLastSpawn > 10; // Cooldown of 10 frames
            
            // Spawn a new ball when balls collide (with cooldown to prevent multiple spawns)
            // Only spawn if balls are approaching (velocityAlongNormal < 0)
            if (canSpawn && velocityAlongNormal < 0) {
                // Spawn a new ball at the midpoint of collision
                const midX = (ball1.x + ball2.x) / 2;
                const midY = (ball1.y + ball2.y) / 2;
                console.log(`*** SPAWNING NEW BALL at (${midX.toFixed(1)}, ${midY.toFixed(1)}) from collision between balls ${ball1Index} and ${ball2Index} ***`);
                console.log(`  Distance: ${distance.toFixed(1)}, velAlongNormal: ${velocityAlongNormal.toFixed(3)}, frame: ${this.frameCount}`);
                this.spawnNewBall(midX, midY);
                this.collisionCooldown.set(pairKey, this.frameCount);
                console.log(`Total balls now: ${this.balls.length}`);
            } else if (this.frameCount < 300 && distance < minDistance * 0.9) {
                console.log(`Spawn blocked - canSpawn: ${canSpawn}, velAlongNormal: ${velocityAlongNormal.toFixed(3)}, framesSinceLastSpawn: ${framesSinceLastSpawn}`);
            }

            // Mark this pair as colliding this frame
            this.collisionPairs.add(pairKey);

            // Only resolve physics if balls are approaching (not separating)
            if (velocityAlongNormal < 0) {
                // Separate balls to prevent overlap
                const overlap = minDistance - distance;
                const separationX = normalX * overlap * 0.5;
                const separationY = normalY * overlap * 0.5;
                ball1.x -= separationX;
                ball1.y -= separationY;
                ball2.x += separationX;
                ball2.y += separationY;

                // Calculate impulse scalar (elastic collision)
                const restitution = 0.9; // Bounciness factor
                const impulseScalar = -(1 + restitution) * velocityAlongNormal;

                // Apply impulse
                ball1.vx -= impulseScalar * normalX;
                ball1.vy -= impulseScalar * normalY;
                ball2.vx += impulseScalar * normalX;
                ball2.vy += impulseScalar * normalY;

                return true;
            } else {
                // Balls are separating but still overlapping - just mark as colliding
                // but don't resolve physics (they'll separate naturally)
                return false;
            }
        }
        return false;
    }

    // Draw the circular boundary
    drawBoundary() {
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.circleRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
    }

    // Main animation loop
    animate() {
        // Increment frame counter
        this.frameCount++;

        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw boundary
        this.drawBoundary();

        // Save previous frame's collisions, then clear for new frame
        this.previousCollisionPairs = new Set(this.collisionPairs);
        this.collisionPairs.clear();

        // Update and draw each ball
        for (const ball of this.balls) {
            ball.update();
            this.checkBoundaryCollision(ball);
        }

        // Check collisions between all pairs of balls
        for (let i = 0; i < this.balls.length; i++) {
            for (let j = i + 1; j < this.balls.length; j++) {
                this.checkBallCollision(this.balls[i], this.balls[j], i, j);
            }
        }

        // Draw all balls
        for (const ball of this.balls) {
            ball.draw(this.ctx);
        }

        // Continue animation
        requestAnimationFrame(() => this.animate());
    }

    // Start the simulation
    start() {
        this.animate();
    }
}

// Initialize and start simulation when page loads
window.addEventListener('DOMContentLoaded', () => {
    const simulation = new BouncingBallsSimulation('canvas');
    console.log('Simulation initialized');
    simulation.start();
});


