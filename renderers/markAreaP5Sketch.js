// x, y, w, h
let area = [0,0,0,0];
let dragging = false;

const sketch = (p) => {

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight)
    p.stroke(100, 120, 180, 100);
    p.strokeWeight(3);
    p.fill(100, 100, 100, 100)
  }


  p.draw = () => {
    if (dragging) {
      p.clear(255, 255, 255, 1);
      p.rect(area[0], area[1], area[2], area[3]);
    }
  }

  p.mousePressed = () => {
    area[0] = p.mouseX;
    area[1] = p.mouseY;
    area[2] = 0;
    area[3] = 0;
    dragging = true;
  }

  p.mouseDragged = () => {
    area[2] = (p.mouseX - area[0]);
    area[3] = (p.mouseY - area[1]);
  }

  p.mouseReleased = () => {
    dragging = false;

    if (area[2] < 0) {
      area[2] = Math.abs(area[2])
      area[0] -= area[2]
    }

    if (area[3] < 0) {
      area[3] = Math.abs(area[3])
      area[1] -= area[3]
    }

    const rect = {
      x: area[0],
      y: area[1],
      width: area[2],
      height: area[3],
    }

    window.electronAPI.areaMarked(rect);
    window.close();
  }

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight)
  }

}

new p5(sketch);