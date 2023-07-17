import logging

import numpy as np
from image_utils import image_processing as ip


def score_function(arr1: np.ndarray, arr2: np.ndarray) -> float:
    """
    Compute the score of two one-dimensional arrays.
    Our score is the cosine similarity between the two image arrays.
    Can be customized to other similarity functions.

    NOTE: If this function is changed, adjust the match_score_threshold
    command line argument in src/main.py
    """
    norm = np.linalg.norm
    return 1 - np.dot(arr1, arr2) / (norm(arr1) * norm(arr2))


def compute_match_score_of_slice(image_slice: np.ndarray,
                                 image_reference_slice: np.ndarray
                                 ) -> float:
    """
    Compute the match score of an image slice and a single image reference
    slice. The match score function is defined in score_function.
    """
    grayscale_image_slice = ip.convert_to_grayscale(image_slice)
    grayscale_image_ref_slice = ip.convert_to_grayscale(image_reference_slice)

    img_array = grayscale_image_slice.reshape(-1)
    ref_img_array = grayscale_image_ref_slice.reshape(-1)

    score = score_function(img_array, ref_img_array)

    return score


def compute_match_scores(image_slice: np.ndarray,
                         image_reference: np.ndarray,
                         ) -> np.ndarray:
    """
    Compute the match scores of an image slice and an image reference.
    """
    slice_size = image_slice.shape[0]
    crop_slices = ip.create_list_of_crop_slices(image_reference, slice_size)

    scores = [compute_match_score_of_slice(image_slice, crop_slice)
              for crop_slice in crop_slices]
    return np.array(scores)


def get_crop_direction(args, crop_images):
    """
    Get the direction of the crop. This is done by comparing the match scores
    of the top slice of the crop and the reference image, and the bottom slice
    of the crop and the reference image. The direction of the crop is the
    direction with the lowest match score.
    """
    logging.debug("Getting crop function")
    scroll_crop_0 = crop_images[0]
    scroll_crop_1 = crop_images[1]

    logging.debug("Computing top slice crop 0")
    top_left_crop_0 = ip.crop_image_slice(scroll_crop_0,
                                          args.n_rows_in_crop,
                                          args.n_cols_in_crop,
                                          args.left_crop_from,
                                          args.left_crop_to,
                                          args.right_crop_from,
                                          args.right_crop_to)
    logging.debug("Computing top slice crop 1")
    top_left_crop_1 = ip.crop_image_slice(scroll_crop_1,
                                          args.n_rows_in_crop,
                                          args.n_cols_in_crop,
                                          args.left_crop_from,
                                          args.left_crop_to,
                                          args.right_crop_from,
                                          args.right_crop_to)
    logging.debug("Computing reference crop 0")
    left_crop_0 = ip.crop_image_reference(scroll_crop_0,
                                          args.n_cols_in_crop,
                                          args.left_crop_from,
                                          args.left_crop_to,
                                          args.right_crop_from,
                                          args.right_crop_to)
    logging.debug("Computing reference crop 1")
    left_crop_1 = ip.crop_image_reference(scroll_crop_1,
                                          args.n_cols_in_crop,
                                          args.left_crop_from,
                                          args.left_crop_to,
                                          args.right_crop_from,
                                          args.right_crop_to)

    logging.debug("Computing top match scores")
    top_match_scores = compute_match_scores(top_left_crop_1, left_crop_0)
    logging.debug("Computing bottom match scores")
    bottom_match_scores = compute_match_scores(top_left_crop_0, left_crop_1)

    logging.debug("Finding min scores")
    top_min_score = np.min(top_match_scores)
    bottom_min_score = np.min(bottom_match_scores)

    logging.debug(f"top_min_score: {top_min_score}, "
                  + f"bottom_min_score: {bottom_min_score}")
    if top_min_score < bottom_min_score:
        return "down"
    return "up"
