// x, y, w, h
let area = [0,0,0,0];
let dragging = false;
let alpha = 90;
let closing = false;
let resultRect = null;
let fillColor = null;
let strokeColor = null;

function close() {
  alpha -= 8;
}

const sketch = (p) => {

  strokeColor = p.color(80, 110, 180, alpha)
  fillColor = p.color(10, 10, 100, alpha)

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight)
    p.stroke(strokeColor);
    p.strokeWeight(2);
    p.fill(fillColor)
  }


  p.draw = () => {
    if (alpha < 0) {
      p.clear(255, 255, 255, 1);
      window.close();
      closing = false;
      p.noLoop();
    }

    if (dragging || closing) {
      fillColor.setAlpha(alpha);
      strokeColor.setAlpha(alpha);
      p.clear(255, 255, 255, 1);
      p.fill(fillColor)
      p.rect(area[0], area[1], area[2], area[3]);
    }

    if (closing) {
      alpha = alpha - 32;
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

    resultRect = {
      x: area[0],
      y: area[1],
      width: area[2],
      height: area[3],
    }

    window.electronAPI.areaMarked(resultRect);
    closing = true;
  }

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight)
  }

}

new p5(sketch);