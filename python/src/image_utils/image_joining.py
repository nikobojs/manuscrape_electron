import logging
from typing import List, Tuple

import numpy as np


def join_images_vertically_top_wise(image_from: np.ndarray, 
                                    image_to: np.ndarray,
                                    min_score_index: int
                                    ) -> np.ndarray:
    """
    Join two images vertically, such that the image_from is placed on top of the
    image_to. The image_from is placed at the index min_score_index of the image_to.
    """
    new_image_shape = (min_score_index + image_to.shape[0], image_to.shape[1], 3)
    new_image = np.zeros(new_image_shape,
                         dtype=np.uint8)
    # Where we place the new image = 
    # The index such that we can place the new picture at the bottom.
    # Can also be read as (image_to.shape[0] + min_score_index) - image_from.shape[0]
    # For clarification.
    at_row = image_to.shape[0] + min_score_index - image_from.shape[0]
    new_image[:at_row] = image_to[:at_row]
    new_image[at_row:] = image_from
    return new_image


def join_series_vertically_top_wise(crop_images: List[np.ndarray],
                                    min_score_indices: np.ndarray
                                    ) -> np.ndarray:
    """
    Join a series of images vertically, such that the image at index 0 is placed
    at the top of the new image, and the image at index -1 is placed at the bottom
    of the new image.
    """
    logging.info("joining images. Starting with image 0 as new_image")
    new_image = crop_images[0]

    logging.debug(f"new_image.shape: {new_image.shape}")
    for i, (crop_image, min_score_index) in enumerate(zip(crop_images[1:],
                                                          min_score_indices)):
        new_image = join_images_vertically_top_wise(crop_image,
                                                    new_image,
                                                    min_score_index)
        logging.info(f"joined image {i + 1} to new_image")
    logging.info("joined all images")

    return new_image


def join_image_with_boundaries(image: np.ndarray,
                               boundaries: Tuple[np.ndarray, np.ndarray,
                                                 np.ndarray, np.ndarray]
                               ) -> np.ndarray:
    """
    Join an image with boundaries. The boundaries are placed around the image.
    """
    left_b, right_b, top_b, bottom_b = boundaries

    left_b_dim = left_b.shape[1]
    right_b_dim = right_b.shape[1]
    top_b_dim = top_b.shape[0]
    bottom_b_dim = bottom_b.shape[0]
    new_image_h_dim = image.shape[0]
    new_image_v_dim = image.shape[1]

    image_horizontal_dim = new_image_h_dim + top_b_dim + bottom_b_dim
    image_vertical_dim = new_image_v_dim + left_b_dim + right_b_dim

    final_new_image_shape = (image_horizontal_dim, image_vertical_dim, 3)
    final_new_image = np.zeros(final_new_image_shape, dtype=np.uint8)

    # Complicated joining and indexing. Just believe it the numpy.
    # It inserts the image in the middle of the final_new_image.
    # The borders then go around it.
    final_new_image[top_b_dim:top_b_dim + new_image_h_dim,
                    left_b_dim: left_b_dim + new_image_v_dim, :] = image
    final_new_image[top_b_dim:top_b_dim + new_image_h_dim,
                    :left_b_dim, :] = left_b
    final_new_image[top_b_dim:top_b_dim + new_image_h_dim,
                    left_b.shape[1] + image.shape[1]:, :] = right_b
    final_new_image[:top_b.shape[0], :, :] = top_b
    final_new_image[top_b.shape[0] + image.shape[0]:, :, :] = bottom_b

    return final_new_image
