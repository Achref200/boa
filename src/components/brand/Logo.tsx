import Image from 'next/image';
import mark from '../../../public/brand/boa-logo.png';

/**
 * The official BOA mark, used as supplied.
 *
 * The only preparation applied was keying out its own measured ground
 * (#27282A) so the artwork can sit directly on BOA's ink surface without a
 * JPEG square — the letterforms, the profile in the counter and the petals are
 * untouched. The mark is drawn for a dark ground and its "COSMETIC" line is
 * white, which is precisely why the site's header, footer and brand moments are
 * ink: presenting this logo on a pale surface would break it.
 */
export function Logo({
  size = 44,
  priority = false,
  className,
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={mark}
      alt="BOA Cosmetic"
      width={size}
      height={size}
      priority={priority}
      sizes={`${size}px`}
      className={className}
    />
  );
}
