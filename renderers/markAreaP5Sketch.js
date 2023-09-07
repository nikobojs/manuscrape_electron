// x, y, w, h
let area = [0,0,0,0];
let dragging = false;
let alpha = 180;
let closing = false;
let resultRect = null;
let fillColor = null;
let strokeColor = null;

function close() {
  alpha -= 16;
}

const sketch = (p) => {

  strokeColor = p.color(80, 110, 180, 1)
  fillColor = p.color(23, 29, 38, alpha)

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.background(fillColor);
    window.focus();
  }


  p.draw = () => {
    if (alpha < 0) {
      p.clear(255, 255, 255, 1);
      window.electronAPI.areaMarked(resultRect);
      closing = false;
      window.close();
      p.noLoop();
    }

    if (dragging || closing) {
      p.clear(255, 255, 255, 1);
      fillColor.setAlpha(alpha);
      strokeColor.setAlpha(alpha);
      p.noStroke();
      p.fill(fillColor);

      const minX = Math.min(area[0], area[2] + area[0]);
      const minY = Math.min(area[1], area[3] + area[1]);
      const maxX = Math.max(area[0], area[2] + area[0]);
      const maxY = Math.max(area[1], area[3] + area[1]);
      const w = Math.abs(area[2]);
      const h = Math.abs(area[3]);


      p.rect(0, 0, p.windowWidth, minY)
      p.rect(0, minY, minX, h)
      p.rect(maxX, minY, p.windowWidth - maxX, h)
      p.rect(0, maxY, p.windowWidth, p.windowHeight - maxY)

      p.noFill();
      p.stroke(strokeColor)
      p.strokeWeight(2);

      p.rect(minX, minY, w, h)

      if (closing) {
        alpha = alpha - 32;
      }
    } else {
      p.clear(255, 255, 255, 1);
      p.background(fillColor);
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

    closing = true;
  }

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight)
  }

}

new p5(sketch);