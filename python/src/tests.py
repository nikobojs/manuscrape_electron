import logging
import sys
import argparse
import os

import numpy as np
import image_utils.image_io as iio
import image_utils.image_joining as ij
import image_utils.image_matching as im
import image_utils.image_processing as ip


def test_full_join(args: argparse.Namespace) -> int:
    logging.debug("Running full test")

    if not os.path.exists("test_images"):
        os.makedirs("test_images")
        logging.debug("created directory test_images/")

    logging.debug("Reading images")
    images = iio.load_images(args.input_folder)
    logging.debug("Converting images to numpy arrays")
    np_images = iio.images_to_np(images)

    logging.debug("original image shape: %s", np_images[0].shape)

    logging.debug("Creating filter frame")
    filter_frame = ip.create_npimage_filter(np_images[-1],
                                            np_images[0],
                                            args.denoising_factor)
    logging.debug("Finding crop coordinates")
    crop_indices = ip.find_frame_boundary_of_npimage_filter(filter_frame)
    iio.write_npimage_to_file(filter_frame, "test_images/ex_image_filter.png")
    logging.debug("crop_indices: %s", crop_indices)

    logging.debug("Cropping images by indices")
    crop_images = ip.crop_images_by_indices(np_images, crop_indices)
    logging.debug(f"Shape of cropped images: {crop_images[0].shape}")
    n_crops_before = len(crop_images)
    logging.debug(f"Number of crop images before removing duplicates: {n_crops_before}")

    logging.debug("Removing initial identical crop images")
    crop_images = ip.remove_identical_crop_images(crop_images)
    n_crops_removed = n_crops_before - len(crop_images)
    logging.debug(f"removed initial {n_crops_removed} identical crop images")

    logging.debug("Computing crop direction")
    crop_direction = im.get_crop_direction(args, crop_images)
    crop_images = crop_images[::-1] if crop_direction == "up" else crop_images
    logging.debug(f"crop_direction: {crop_direction}")
    logging.debug("Computing slice crops")
    image_slice_crops = [ip.crop_image_slice(crop_image,
                                             args.n_rows_in_crop,
                                             args.n_cols_in_crop,
                                             args.left_crop_from,
                                             args.left_crop_to,
                                             args.right_crop_from,
                                             args.right_crop_to)
                         for crop_image in crop_images[1:]]
    logging.debug("Computing reference crops")
    image_reference_crops = [ip.crop_image_reference(crop_image,
                                                     args.n_cols_in_crop,
                                                     args.left_crop_from,
                                                     args.left_crop_to,
                                                     args.right_crop_from,
                                                     args.right_crop_to)
                             for crop_image in crop_images[:-1]]
    logging.debug(f"Number of comparisons: {len(image_slice_crops)}")

    for i, (slice_crop, reference_crop) in enumerate(zip(image_slice_crops,
                                                         image_reference_crops)):
        logging.debug(f"Writing slice crop {i} to file")
        iio.write_npimage_to_file(slice_crop, f"test_images/ex_slice_crop_{i}.png")
        logging.debug(f"Writing reference crop {i} to file")
        iio.write_npimage_to_file(reference_crop,
                                  f"test_images/ex_reference_crop_{i}.png")

    logging.debug("Computing match scores for all crops")
    min_score_indices = []
    # min_scores = []
    for i, (crop, crop_image) in enumerate(zip(image_slice_crops,
                                               image_reference_crops)):
        logging.debug(f"computing match scores for crop {i}")
        match_score = im.compute_match_scores(crop, crop_image)
        min_match_score = np.min(match_score)
        if min_match_score > args.match_score_threshold:
            logging.warning(f"match score {min_match_score} is \
                           above threshold {args.match_score_threshold}")
            # Print error message to stderr
            sys.stderr.write("Error when computing best match for image: \
                             smallest match score above threshold.\n")
            return 1

        # min_scores = np.append(min_scores, min_match_score)
        min_score_indices.append(np.argmin(match_score))

    # min_scores = np.array(min_scores)
    min_score_indices = np.array(min_score_indices)

    # logging.debug(f"min_scores: {min_scores}")
    # logging.debug(f"min_score_indices: {min_score_indices}")

    logging.debug("finished computing match scores for all crops")

    logging.debug("Joining images")
    new_image = ij.join_series_vertically_top_wise(crop_images, min_score_indices)
    logging.debug("new image shape: %s", new_image.shape)

    logging.debug("Extracting image boundaries from first the first image")
    new_image_boundaries = ip.extract_image_boundaries_by_indices(np_images[0],
                                                                  crop_indices)

    logging.debug("fitting boundaries to new image")
    new_image_boundaries = ip.extend_boundaries_to_new_image_shape(new_image_boundaries,
                                                                   new_image.shape)

    new_image_with_boundaries = ij.join_image_with_boundaries(new_image,
                                                              new_image_boundaries)

    logging.debug(f"new image with boundaries shape: {new_image_with_boundaries.shape}")

    logging.debug("writing new image to file")
    iio.write_npimage_to_file(new_image_with_boundaries,
                              f"test_images/{args.output_filename}")
    logging.info("Successfully joined images.")
    logging.debug("Finished full test")
    return 0
