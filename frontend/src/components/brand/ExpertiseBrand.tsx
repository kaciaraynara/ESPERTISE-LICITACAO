import BrandLogo from './BrandLogo';

type ExpertiseBrandProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  compact?: boolean;
  [key: string]: unknown;
};

export function ExpertiseBrand({
  className = '',
  imageClassName,
  showText = true,
  compact = false,
}: ExpertiseBrandProps) {
  const resolvedImageClassName =
    imageClassName || (compact ? 'h-10 w-auto' : showText ? 'h-14 w-auto' : 'h-10 w-auto');

  return (
    <BrandLogo
      className={className}
      imageClassName={resolvedImageClassName}
      showTagline={showText}
    />
  );
}

export default ExpertiseBrand;