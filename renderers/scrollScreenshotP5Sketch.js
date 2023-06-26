function setup() {
  createCanvas(windowWidth, windowHeight)
  stroke(100, 120, 180, 100);
  strokeWeight('3');
  fill(100, 100, 100, 100)
}


// x, y, w, h
let area = [0,0,0,0];
let dragging = false;


function draw() {
  if (dragging) {
    clear();
    rect(...area);
  }
}


function mousePressed() {
  console.log('mouse pressed event:', window.electronAPI.node)
  console.log(mouseX, mouseY)
  area[0] = mouseX;
  area[1] = mouseY;
  area[2] = 0;
  area[3] = 0;
  dragging = true;
}

function mouseDragged() {
   area[2] = (mouseX - area[0]);
   area[3] = (mouseY - area[1]);
}

function mouseReleased() {
  console.log('mouse released event:')
  console.log(mouseX, mouseY)
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

  
  window.electronAPI.scrollScreenshot(rect);
  window.close();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

