// The code in this file is copy pasted and modified a bit. Original is
// https://github.com/commonsmachinery/blockhash-js/blob/master/index.js

import jpeg from 'jpeg-js'

function median(
  data: Uint8Array
): number {
  var mdarr = data.slice(0);
  mdarr.sort(function (a: number, b: number) { return a - b; });
  if (mdarr.length % 2 === 0) {
    return (mdarr[mdarr.length / 2 - 1] + mdarr[mdarr.length / 2]) / 2.0;
  }
  return mdarr[Math.floor(mdarr.length / 2)];
};

function translateBlocksToBits(
  blocks: Uint8Array,
  pixelsPerBlock: number
): void {
  const half_block_value = pixelsPerBlock * 256 * 3 / 2;
  const bandsize = blocks.length / 4;

  // Compare medians across four horizontal bands
  for (let i = 0; i < 4; i++) {
    const m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
    for (let j = i * bandsize; j < (i + 1) * bandsize; j++) {
      const v = blocks[j];

      // Output a 1 if the block is brighter than the median.
      // With images dominated by black or white, the median may
      // end up being 0 or the max value, and thus having a lot
      // of blocks of value equal to the median.  To avoid
      // generating hashes of all zeros or ones, in that case output
      // 0 if the median is in the lower value space, 1 otherwise
      blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > half_block_value));
    }
  }
};

function bitsToHexhash(
  bitsArray: Uint8Array
): string {
  const hex = [];
  for (let i = 0; i < bitsArray.length; i += 4) {
    const nibble = bitsArray.slice(i, i + 4);
    hex.push(parseInt(nibble.join(''), 2).toString(16));
  }

  return hex.join('');
};

function bmvbhashEven(
  data: jpeg.BufferRet,
  bits: number
): string {
  const blocksize_x = Math.floor(data.width / bits);
  const blocksize_y = Math.floor(data.height / bits);
  const tmpResult: number[] = [];

  for (let y = 0; y < bits; y++) {
    for (let x = 0; x < bits; x++) {
      let total = 0;

      for (let iy = 0; iy < blocksize_y; iy++) {
        for (let ix = 0; ix < blocksize_x; ix++) {
          const cx = x * blocksize_x + ix;
          const cy = y * blocksize_y + iy;
          const ii = (cy * data.width + cx) * 4;

          const alpha = data.data[ii + 3];
          if (alpha === 0) {
            total += 765;
          } else {
            total += data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
          }
        }
      }
      tmpResult.push(total);
    }
  }

  const result = new Uint8Array(tmpResult)
  translateBlocksToBits(result, blocksize_x * blocksize_y);
  return bitsToHexhash(result);
};


function bmvbhash(
  data: jpeg.BufferRet,
  bits: number
): string {
  const tmpResult: number[] = [];
  const block_width = data.width / bits;
  const block_height = data.height / bits;
  const blocks: number[][] = [];
  const even_x = data.width % bits === 0;
  const even_y = data.height % bits === 0;
  let i, j, x, y;
  let weight_top, weight_bottom, weight_left, weight_right;
  let block_top, block_bottom, block_left, block_right;
  let y_mod, y_frac, y_int;
  let x_mod, x_frac, x_int;

  if (even_x && even_y) {
    return bmvbhashEven(data, bits);
  }

  // initialize blocks array with 0s
  for (i = 0; i < bits; i++) {
    blocks.push([]);
    for (j = 0; j < bits; j++) {
      blocks[i].push(0);
    }
  }

  for (y = 0; y < data.height; y++) {
    if (even_y) {
      // don't bother dividing y, if the size evenly divides by bits
      block_top = block_bottom = Math.floor(y / block_height);
      weight_top = 1;
      weight_bottom = 0;
    } else {
      y_mod = (y + 1) % block_height;
      y_frac = y_mod - Math.floor(y_mod);
      y_int = y_mod - y_frac;

      weight_top = (1 - y_frac);
      weight_bottom = (y_frac);

      // y_int will be 0 on bottom/right borders and on block boundaries
      if (y_int > 0 || (y + 1) === data.height) {
        block_top = block_bottom = Math.floor(y / block_height);
      } else {
        block_top = Math.floor(y / block_height);
        block_bottom = Math.ceil(y / block_height);
      }
    }

    for (x = 0; x < data.width; x++) {
      var ii = (y * data.width + x) * 4;

      var avgvalue, alpha = data.data[ii + 3];
      if (alpha === 0) {
        avgvalue = 765;
      } else {
        avgvalue = data.data[ii] + data.data[ii + 1] + data.data[ii + 2];
      }

      if (even_x) {
        block_left = block_right = Math.floor(x / block_width);
        weight_left = 1;
        weight_right = 0;
      } else {
        x_mod = (x + 1) % block_width;
        x_frac = x_mod - Math.floor(x_mod);
        x_int = x_mod - x_frac;

        weight_left = (1 - x_frac);
        weight_right = x_frac;

        // x_int will be 0 on bottom/right borders and on block boundaries
        if (x_int > 0 || (x + 1) === data.width) {
          block_left = block_right = Math.floor(x / block_width);
        } else {
          block_left = Math.floor(x / block_width);
          block_right = Math.ceil(x / block_width);
        }
      }

      // add weighted pixel value to relevant blocks
      blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
      blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
      blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
      blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
    }
  }

  for (i = 0; i < bits; i++) {
    for (j = 0; j < bits; j++) {
      tmpResult.push(blocks[i][j]);
    }
  }

  const result = new Uint8Array(tmpResult)
  translateBlocksToBits(result, block_width * block_height);
  return bitsToHexhash(result);
};

export function blockhashData(
  imgData: jpeg.BufferRet,
  bits: number,
  method: 1 | 2
): string {
  var hash;

  if (method === 1) {
    hash = bmvbhashEven(imgData, bits);
  }
  else if (method === 2) {
    hash = bmvbhash(imgData, bits);
  }
  else {
    throw new Error("Bad hashing method");
  }

  return hash;
};

// calculate the hamming distance for two hashes in hex format
export function hammingDistance(
  hash1: string,
  hash2: string
): number {
  const one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
  let distance = 0;

  if (hash1.length !== hash2.length) {
    throw new Error("Can't compare hashes with different length");
  }

  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    distance += one_bits[n1 ^ n2];
  }

  return distance;
};
