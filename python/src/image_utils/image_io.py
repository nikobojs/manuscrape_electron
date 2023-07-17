import os
from os import path
from typing import List

import numpy as np
from PIL import Image


def load_image(img_path: str) -> Image.Image:
    """
    Load an image from a path and return it as an Image.Image object.
    """
    img = Image.open(img_path)
    return img


def load_images(folder_path: str) -> List[Image.Image]:
    """
    Load all images from a path and return them as a list of Image.Image objects.
    """
    img_paths = [path.join(folder_path, img) for img in os.listdir(folder_path)]
    img_paths = sorted(img_paths)

    return [load_image(img_path) for img_path in img_paths]


def image_to_np(image: Image.Image) -> np.ndarray:
    """
    Convert an Image.Image to a numpy array.
    """
    return np.array(image)


def images_to_np(images: List[Image.Image]) -> List[np.ndarray]:
    """
    Convert a list of Image.Images to a list of numpy arrays.
    """
    return [image_to_np(image) for image in images]


def write_npimage_to_file(image: np.ndarray, file_path: str):
    """
    Write a numpy array as an image to a file. Supports 1 channel for black/white and
    3 channels for color.
    """
    img = Image.fromarray(image)
    img.save(file_path)
