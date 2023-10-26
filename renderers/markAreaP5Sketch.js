// x, y, w, h
let hideArea = false;
let area = [0,0,0,0];
let dragging = false;
let resultRect = null;
let fillColor = null;
let strokeColor = null;
let spinnerSize = 28;
let spinnerSpeed = 8;
let spinnerColor;
let statusText = '';
let statusDescription = '';

function drawArea(p, area) {
  p.push()
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

  p.rect(minX, minY, w, h);
  p.pop();
}

function drawProcessing(p) {
  let step = p.frameCount % (spinnerSpeed * 7.25);
  let angle = p.map(step, 0, spinnerSpeed * 7.25, 0, p.TWO_PI);
  // create text and box
  p.push();
  p.translate(p.windowWidth - 64, 32);
  p.noStroke()
  p.fill(10, 10, 10, 190);
  p.rect(-390, -32, 454, 88)
  p.stroke(spinnerColor);
  p.fill(spinnerColor);
  p.strokeWeight(1);
  p.textSize(28);
  p.textAlign(p.RIGHT, p.CENTER);
  p.text(statusText, -50, 0)
  p.fill(spinnerColor);
  p.textSize(16);
  p.text(statusDescription, -50, 30)
  p.pop();
  
  // create rotating spinner
  p.push();
  p.translate(p.windowWidth - 64, 32);
  p.rotate(angle);
  p.noFill();
  p.stroke(spinnerColor);
  p.strokeWeight(5);
  p.strokeCap(p.SQUARE);
  p.arc(0, 0, spinnerSize - (spinnerSize / 20), spinnerSize - (spinnerSize / 20), 0, p.PI + p.HALF_PI, p.OPEN);
  p.pop();
}

const sketch = (p) => {
  strokeColor = p.color(80, 110, 180, 1)
  fillColor = p.color(23, 29, 38, 130)
  spinnerColor = p.color(33, 150, 243);

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.background(fillColor);
    window.focus();
  }

  p.draw = () => {
    p.clear(255, 255, 255, 1);
    if (dragging) {
      drawArea(p, area);
    } else if(resultRect && statusText && typeof statusDescription === 'string') {
      hideArea || drawArea(p, area);
      drawProcessing(p);
    } else if (!resultRect) {
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

    const width = area[2];
    const height = area[3];

    if (width <= 0 || height <= 0) {
      return;
    }

    resultRect = {
      x: area[0],
      y: area[1],
      width,
      height,
    }

    window.electronAPI.areaMarked(resultRect);
  }

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight)
  }
}

window.electronAPI.onStatus((_event, status) => {
  statusText = status.statusText;
  statusDescription = status.statusDescription;
  hideArea = status.hideArea;
});

new p5(sketch);