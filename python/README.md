
# Chatjoiner - Connecting screenshots into one image

## Introduction

This is the python code for an application with the purpose of connecting a series of screenshots into one image.

## Structure

The algorithm is divided into three sections:

- Image preprocessing
- Image matching
- Image joining

### Image preprocessing

In the image preprocessing step we load images and identify what parts of the image are part of the frame of the images, and what parts are the actual content of the images. After this boundary is identified, we crop the images to only contain the content.

### Image matching

The first part of image matching is determining whether the user has scrolled up or down when recording images. This is done by comparing the first image to the second image. If the first image is higher than the second image, the user has scrolled up. If the first image is lower than the second image, the user has scrolled down. If the images are the same height, the user has not scrolled.

When the scroll direction has been determined, we can match each image with the image before it to find the location with the best match. If the scroll direction is down, we match an image and the image before it by cropping a part of the top section of the second image and convolve through the first image. The best match is the one that has the lowest computed match score (a function determined in code and whos similarity measure can be easily changed).

### Image joining

Once image matching has concluded we know the indices of where each image should be stiched together. The joining is performed by creating a new empty image and inserting each image in its appropriate location. Finally the sides that were cropped in the beginning are added back to the new image.

## Installation

The following snippets creates a virtual environment and installs the appropriate packages, after which the code can be compiled, and later bundled into the electron application.

```cd manuscrape_electron/python```

```python3 -m venv env```

```source env/bin/activate```

```pip3 install -r requirements.txt```

## Usage

The following command will run the code on the images in the folder ```<path_to_images>``` and save the result in ```<output_name>.jpg```. The ```--test``` flag will run the code on the test images in the ```test_images``` folder.

```python main.py <path_to_images> <output_name>.jpg```

```python main.py <path_to_images> <output_name>.jpg --test --logging_mode debug```

## Requirements

python 3.11.4
numpy 1.25.0
