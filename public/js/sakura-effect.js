class Petal {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * window.innerWidth;
    this.y = Math.random() * -window.innerHeight;
    this.z = Math.random() * 0.5 + 0.5;
    this.size = this.z * 20 + 10;
    this.speedY = this.z * 1.5 + 0.5;
    this.speedX = Math.random() * 1 - 0.5;
    this.angle = Math.random() * 360;
    this.rotateSpeed = (Math.random() - 0.5) * 2;
    this.swing = Math.random() * 100 + 50;
  }

  update() {
    this.y += this.speedY;
    this.x += Math.sin((this.y + this.angle) / this.swing) * this.z * 2 + this.speedX;
    this.angle += this.rotateSpeed;

    if (this.y > window.innerHeight + this.size) {
      this.reset();
      this.y = -this.size;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.angle * Math.PI) / 180);
    ctx.drawImage(this.image, -this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

class SakuraEffect {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.petals = [];
    this.petalImage = new Image();
    this.isRunning = false;
    this.MAX_PETALS = 150;
    this.initCanvas();
    this.loadPetalImage();
  }

  initCanvas() {
    this.canvas.id = 'sakura-canvas';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1';
    document.body.appendChild(this.canvas);
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  loadPetalImage() {
    this.petalImage.src = 'data:image/svg+xml;base64,' +
      btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><path fill="#f9c1d9" d="M15 2 C12 6, 8 8, 7 13 C6 18, 11 24, 15 28 C19 24, 24 18, 23 13 C22 8, 18 6, 15 2 Z"/></svg>`);
    this.petalImage.onload = () => this.initPetals();
  }

  initPetals() {
    for (let i = 0; i < this.MAX_PETALS; i++) {
      const petal = new Petal();
      petal.image = this.petalImage;
      this.petals.push(petal);
    }
    this.startAnimation();
  }

  startAnimation() {
    if (this.isRunning) return;
    this.isRunning = true;
    const animate = () => {
      if (!this.isRunning) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.petals.forEach(petal => {
        petal.update();
        petal.draw(this.ctx);
      });
      requestAnimationFrame(animate);
    };
    animate();
  }

  stopAnimation() {
    this.isRunning = false;
  }
}
window.SakuraEffect = SakuraEffect;