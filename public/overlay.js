function setup() {
  createCanvas(windowWidth, windowHeight)
  stroke(100, 120, 180, 100);
  strokeWeight('3');
  fill(100, 100, 100, 100)
}


let square = [0,0,0,0];
let dragging = false;


function draw() {
  if (dragging) {
    clear();
    console.log('dragging square!')
    console.log(square)
    rect(...square);
  }
}


function mousePressed() {
  console.log('mouse pressed event:')
  console.log(mouseX, mouseY)
  square[0] = mouseX;
  square[1] = mouseY;
  square[2] = 0;
  square[3] = 0;
  dragging = true;
}

function mouseDragged() {
   square[2] = (mouseX - square[0]);
   square[3] = (mouseY - square[1]);
}

function mouseReleased() {
  console.log('mouse released event:')
  console.log(mouseX, mouseY)
  dragging = false;
  window.electronAPI.saveScreenshot(square);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

