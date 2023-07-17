import argparse
import logging
from pprint import pformat
import numpy as np
import sys

import tests
from image_utils import image_io as iio
from image_utils import image_processing as ip
from image_utils import image_matching as im
from image_utils import image_joining as ij


LOGGING_MODES = {
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
                prog="Chat-joiner",
                description="join sequences of chat images into one image")

    parser.add_argument("input_folder", help="input folder")
    parser.add_argument("-o", "--output_filename", action="store",
                        default="out.jpg", help="output filename")
    parser.add_argument("--test", action="store_true", default=False,
                        help="test mode. This mode will execute the script and write "
                             + "all intermediary images to a test folder. Helpful to "
                             + "use with logging_mode=debug.")
    parser.add_argument("--n_rows_in_crop", action="store", type=int, default=25,
                        help="How many rows to include in each scan crop.")
    parser.add_argument("--n_cols_in_crop", action="store", type=int, default=200,
                        help="How many columns to include in each scan crop.")
    parser.add_argument("--denoising_factor", action="store", type=float, default=0.10,
                        help="How much to denoise the image. 0.0 means no denoising.")
    parser.add_argument("--left_crop_from", action="store", type=int, default=20,
                        help="When cropping out centers on the left side, where " +
                             "should this crop start?")
    parser.add_argument("--left_crop_to", action="store", type=int, default=180,
                        help="When cropping out centers on the left side, where "
                             + "should this crop end?")
    parser.add_argument("--right_crop_from", action="store", type=int, default=20,
                        help="When cropping out centers on the right side, where "
                             + " should this crop start?")
    parser.add_argument("--right_crop_to", action="store", type=int, default=200,
                        help="When cropping out centers on the right side, where "
                             + "should this crop end?")
    parser.add_argument("--match_score_threshold", action="store", type=float, 
                        default=0.10, help="How high the maximum match score can be "
                                           + " before we determine an error has "
                                           + "occurred when matching images.")
    parser.add_argument("--logging_mode", action="store", default="warning",
                        choices=LOGGING_MODES.keys(), help="logging mode")

    args = parser.parse_args()

    return args


def test(args):
    tests.test_full_join(args)
    return


def join_chats(args):
    logging.info("Reading images")
    images = iio.load_images(args.input_folder)
    logging.info("Converting images to numpy arrays")
    np_images = iio.images_to_np(images)

    logging.debug("original image shape: %s", np_images[0].shape)

    logging.info("Creating filter frame")
    filter_frame = ip.create_npimage_filter(np_images[-1],
                                            np_images[0],
                                            args.denoising_factor)
    logging.info("Finding crop coordinates")
    crop_indices = ip.find_frame_boundary_of_npimage_filter(filter_frame)
    # iio.write_npimage_to_file(filter_frame, "test/test_full/ex_image_filter.png")
    logging.debug("crop_indices: %s", crop_indices)

    logging.info("Cropping images by indices")
    crop_images = ip.crop_images_by_indices(np_images, crop_indices)
    logging.debug(f"Shape of cropped images: {crop_images[0].shape}")
    n_crops_before = len(crop_images)
    logging.debug(f"Number of crop images before removing duplicates: {n_crops_before}")

    logging.info("Removing initial identical crop images")
    crop_images = ip.remove_identical_crop_images(crop_images)
    n_crops_removed = n_crops_before - len(crop_images)
    logging.debug(f"removed initial {n_crops_removed} identical crop images")

    logging.info("Computing crop direction")
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
    logging.info("Computing reference crops")
    image_reference_crops = [ip.crop_image_reference(crop_image,
                                                     args.n_cols_in_crop,
                                                     args.left_crop_from,
                                                     args.left_crop_to,
                                                     args.right_crop_from,
                                                     args.right_crop_to)
                             for crop_image in crop_images[:-1]]
    logging.debug(f"Number of comparisons: {len(image_slice_crops)}")

    logging.info("Computing match scores for all crops")
    min_score_indices = []
    # min_scores = []
    for i, (crop, crop_image) in enumerate(zip(image_slice_crops,
                                               image_reference_crops)):
        logging.info(f"computing match scores for crop {i}")
        match_score = im.compute_match_scores(crop, crop_image)
        min_match_score = np.min(match_score)
        if min_match_score > args.match_score_threshold:
            logging.warning(f"match score {min_match_score} is \
                            above threshold {args.match_score_threshold}")
            # Print error message to stderr
            sys.stderr.write("Error when computing best match for image: \
                smallest match score above threshold.\n")
            return 1

        min_score_indices.append(np.argmin(match_score))

    min_score_indices = np.array(min_score_indices)

    logging.info("finished computing match scores for all crops")

    logging.info("Joining images")
    new_image = ij.join_series_vertically_top_wise(crop_images, min_score_indices)
    logging.info("new image shape: %s", new_image.shape)

    logging.info("Extracting image boundaries from first the first image")
    new_image_boundaries = ip.extract_image_boundaries_by_indices(np_images[0],
                                                                  crop_indices)

    logging.info("fitting boundaries to new image")
    new_image_boundaries = ip.extend_boundaries_to_new_image_shape(new_image_boundaries,
                                                                   new_image.shape)

    new_image_with_boundaries = ij.join_image_with_boundaries(new_image,
                                                              new_image_boundaries)

    logging.debug(f"new image with boundaries shape: {new_image_with_boundaries.shape}")

    logging.debug("writing new image to file")
    iio.write_npimage_to_file(new_image_with_boundaries,
                              args.output_filename)
    logging.info("Successfully joined images.")
    logging.debug("Finished full test")
    return 0


def main():
    """
    Load all images from a folder and print their shape.
    """
    args = parse_args()

    logging_mode = LOGGING_MODES[args.logging_mode]

    logging.basicConfig(format='%(asctime)s.%(msecs)03d - %(levelname)s %(message)s',
                        level=logging_mode,
                        datefmt="%I:%M:%S")

    logging.debug("Starting program")

    if args.test:
        logging.debug("Running tests")
        logging.debug(pformat(args.__dict__))
        return test(args)

    else:
        logging.debug("Running join_chats")
        logging.debug(pformat(args.__dict__))
        return join_chats(args)


if __name__ == "__main__":
    main()
