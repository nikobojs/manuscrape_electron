from typing import List, Tuple
from collections.abc import Iterable

import numpy as np


def create_npimage_filter(base_image: np.ndarray,
                          other_image: np.ndarray,
                          denoising_factor: float
                          ) -> np.ndarray:
    """
    Create a filter frame for the base image, using the other image as reference.
    This filter frame can then be used to crop out boundaries of the images,
    leaving only content in the image.
    """
    # Find the difference between the two images
    filter_frame = ((base_image - other_image) >= 10).any(axis=2)
    filter_frame = denoise_filter_by_factor(filter_frame, denoising_factor)
    return filter_frame


def denoise_filter_by_factor(filter_frame: np.ndarray,
                             denoising_factor: float
                             ) -> np.ndarray:
    """
    Denoise the filter frame by removing all pixels in rows where the mean
    number of pixels is below the denoising factor.
    """
    x_axis_noise_filtering = (np.mean(filter_frame, axis=1) > denoising_factor)
    y_axis_noise_filtering = (np.mean(filter_frame, axis=0) > denoising_factor)

    filter_frame *= x_axis_noise_filtering.reshape(-1, 1)
    filter_frame *= y_axis_noise_filtering.reshape(1, -1)

    return filter_frame


def find_normal_bound(filter_frame: np.ndarray, axis: int) -> int:
    """
    Find the normal bound of the frame in the image. The normal bound is the
    bound that is closest to the origin from either axis 0 or 1 (left or top)
    """
    bound = np.argmax(filter_frame, axis=axis)
    row_is_all_zeros = np.all(filter_frame == 0, axis=axis)
    bound = np.where(row_is_all_zeros, 1000000, bound)
    return np.min(bound)


def find_reverse_bound(filter_frame: np.ndarray, axis: int) -> int:
    """
    Find the reverse bound of the frame in the image. The reverse bound is the
    bound that is furthest from the origin from either axis 0 or 1 (right or
    bottom)
    """
    flipped_frame = np.flip(filter_frame, axis=axis)
    bound = find_normal_bound(flipped_frame, axis)
    return filter_frame.shape[axis] - bound


def find_left_bound(filter_frame: np.ndarray) -> int:
    """
    Find the left bound of the frame in the image.
    """
    return find_normal_bound(filter_frame, 1)


def find_right_bound(filter_frame: np.ndarray) -> int:
    """
    Find the right bound of the frame in the image.
    """
    return find_reverse_bound(filter_frame, 1)


def find_top_bound(filter_frame: np.ndarray) -> int:
    """
    Find the top bound of the frame in the image.
    """
    return find_normal_bound(filter_frame, 0)


def find_bottom_bound(filter_frame: np.ndarray) -> int:
    """
    Find the bottom bound of the frame in the image.
    """
    return find_reverse_bound(filter_frame, 0)


def find_frame_boundary_of_npimage_filter(filter_frame: np.ndarray
                                          ) -> Tuple[float, float, float, float]:
    """
    Returns a tuple of the coordinates of the frame boundary in the image.
    This boundary is defined as the most extreme coordinates in each corner
    that do not overlap. The coordinates are returned as (left, right, top, bottom).
    """

    # Find the coordinates of the frame boundary
    left_bound = find_left_bound(filter_frame)
    right_bound = find_right_bound(filter_frame)
    top_bound = find_top_bound(filter_frame)
    bottom_bound = find_bottom_bound(filter_frame)

    return left_bound, right_bound, top_bound, bottom_bound


def create_content_boundary(base_image: np.ndarray,
                            reference_image: np.ndarray,
                            denoising_factor: float
                            ) -> Tuple[float, float, float, float]:
    """
    Creates a content boundary for the base image, using the reference image
    and a denoising factor between 0 and 1. The content boundary is defined as the
    boundary of the image that contains the content of the image, and not the
    background.
    """
    filter_frame = create_npimage_filter(base_image, reference_image, denoising_factor)
    crop_indices = find_frame_boundary_of_npimage_filter(filter_frame)
    return crop_indices


def crop_image_by_indices(image: np.ndarray,
                          crop_indices: Tuple[float, float, float, float]
                          ) -> np.ndarray:
    """
    Crop an image using the given coordinates.

    Note: Crop is returned as view of image, not copy
    """
    (left, right, top, bottom) = crop_indices
    return image[top:bottom, left:right]


def crop_images_by_indices(images: List[np.ndarray],
                           crop_indices: Tuple[float, float, float, float]
                           ) -> List[np.ndarray]:
    """
    Crop a list of images using the given coordinates.
    """
    crop_images = [crop_image_by_indices(image, crop_indices) for image in images]
    return crop_images


def extract_image_boundaries_by_indices(image0: np.ndarray,
                                        crop_indices: Tuple[float, float, float, float]
                                        ) -> Tuple[np.ndarray, np.ndarray,
                                                   np.ndarray, np.ndarray]:
    """
    Extract the boundaries of an image using the given coordinates.
    """
    (left, right, top, bottom) = crop_indices
    left_bound = image0[top:bottom, :left]
    right_bound = image0[top:bottom, right:]
    top_bound = image0[:top, :]
    bottom_bound = image0[bottom:, :]
    return left_bound, right_bound, top_bound, bottom_bound


def extend_boundaries_to_new_image_shape(boundaries: Tuple[np.ndarray, np.ndarray,
                                                           np.ndarray, np.ndarray],
                                         new_image_shape: Tuple[int, int, int]
                                         ) -> Tuple[np.ndarray, np.ndarray,
                                                    np.ndarray, np.ndarray]:
    """
    Extends the boundaries to the shape of the new image by stretching the last row of
    left and right boundaries until it fits the new image shape.
    """
    left_b, right_b, top_b, bottom_b = boundaries
    old_height = left_b.shape[0]
    new_height, _, _ = new_image_shape

    new_left = extend_array_vertically(left_b, new_height, old_height)
    new_right = extend_array_vertically(right_b, new_height, old_height)

    return new_left, new_right, top_b, bottom_b


def extend_array_vertically(array, new_height, old_height):
    """
    Extends an array vertically by repeating the last row until it fits the new height.
    """
    last_row = array[-1, :, :]
    array_extension = np.repeat(last_row[None, :, :], new_height - old_height, axis=0)
    new_array = np.concatenate((array, array_extension), axis=0)
    return new_array


def crop_image_from_top(image: np.ndarray,
                        keep_n_rows: int
                        ) -> np.ndarray:
    """
    Crop an image from the top. The argument keep_n_rows specifies how many rows
    to keep from the top
    """
    return image[:keep_n_rows, :]


def crop_image_vertical_center_out(image: np.ndarray,
                                   from_col: int,
                                   to_col: int) -> np.ndarray:
    """
    Crops the vertical center of an image out. The from_col and to_col variables
    notes the range of columns we remove.
    """
    image_left = image[:, :from_col]
    image_right = image[:, to_col:]
    image_joined = np.concatenate((image_left, image_right), axis=1)
    return image_joined


def crop_image_from_left(image: np.ndarray, width: int) -> np.ndarray:
    """
    Crop an image from the left. The width variable notes the width of
    this crop
    """
    return image[:, :width]


def crop_image_from_right(image: np.ndarray, width: int) -> np.ndarray:
    """
    Crop an image from the right. The width variable notes the width of
    this crop
    """
    return image[:, -width:]


def crop_image_from_middle(image: np.ndarray, width: int) -> np.ndarray:
    """
    Crop an image from the vertical middle. The width variable notes the width of
    this crop
    """
    return image[:, image.shape[1] // 2 - width // 2: image.shape[1] // 2 + width // 2]


def concat_crops(crops: Iterable[np.ndarray]) -> np.ndarray:
    """
    Concatenate a list of crops horizontally.
    """
    return np.concatenate(crops, axis=1)


def crop_image_reference(image: np.ndarray,
                         width: int,
                         left_from_col: int,
                         left_to_col: int,
                         right_from_col: int,
                         right_to_col: int
                         ) -> np.ndarray:
    """
    Crop an image from the left with center cut put. The height and width variables
    note the height and width of the crop, while the from_col and to_col variables
    note the range of columns we remove.
    """
    left_crop = crop_image_from_left(image, width)
    right_crop = crop_image_from_right(image, width)
    left_center_crop = crop_image_vertical_center_out(left_crop,
                                                      left_from_col, left_to_col)
    right_center_crop = crop_image_vertical_center_out(right_crop,
                                                       right_from_col, right_to_col)
    return concat_crops([left_center_crop, right_center_crop])


def crop_image_slice(image: np.ndarray,
                     height: int,
                     width: int,
                     left_from_col: int,
                     left_to_col: int,
                     right_from_col: int,
                     right_to_col: int
                     ) -> np.ndarray:
    """
    Crop an image from the top left with center cut put. The height and width variables
    note the height and width of the crop, while the from_col and to_col variables
    note the range of columns we remove.
    """
    top_crop = crop_image_from_top(image, height)
    return crop_image_reference(top_crop, width,
                                left_from_col, left_to_col,
                                right_from_col, right_to_col)


def crop_n_rows_from_image(image: np.ndarray,
                           n: int,
                           offset: int
                           ) -> np.ndarray:
    """
    Crop n rows from the image, starting from the offset.
    """
    cropped_image = image[offset:offset + n]

    return cropped_image


def create_list_of_crop_slices(image: np.ndarray,
                               n: int
                               ) -> List[np.ndarray]:
    """
    Create a list of crop slices from the image, where each slice is n rows long.
    """
    n_rows = image.shape[0]
    offsets = range(0, n_rows - n + 1)
    # assert len(offsets) == n_rows - n + 1
    crop_slices = [crop_n_rows_from_image(image, n, offset) for offset in offsets]
    return crop_slices


def convert_to_grayscale(image: np.ndarray) -> np.ndarray:
    """
    Convert an image to grayscale.

    Uses LUMA transform [https://pillow.readthedocs.io/en/stable/reference/Image.html#PIL.Image.Image.convert],
    The method shouldn't matter as long as it's the same for all images.
    """
    return np.dot(image[..., :3], [0.2989, 0.5870, 0.1140])


def remove_initial_identical_crop_images(crop_images):
    """
    Remove initial identical crop images from the list of crop images.
    Two images are deemed identical if >90% of their pixels are the same.
    """
    similarity = np.mean(crop_images[0] == crop_images[1])

    while similarity >= 0.90:
        crop_images.pop(0)
        similarity = np.mean(crop_images[0] == crop_images[1])

    return crop_images


def remove_identical_crop_images(crop_images):
    """
    Remove identical crop images from the list of crop images from the start
    and end of list.
    """
    crop_images = remove_initial_identical_crop_images(crop_images)
    crop_images = remove_initial_identical_crop_images(crop_images[::-1])
    return crop_images[::-1]
