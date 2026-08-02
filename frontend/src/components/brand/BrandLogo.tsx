type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showTagline?: boolean;
};

export function BrandLogo({
  className = '',
  imageClassName = 'h-12 w-auto',
  showTagline = false,
}: BrandLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/logo.png"
        alt={'EXPERTISE Licitat\u00f3ria'}
        className={`${imageClassName} object-contain`}
        loading="eager"
        decoding="async"
      />

      {showTagline ? (
        <span className="sr-only">
          {'Precis\u00e3o em dados, efici\u00eancia em licita\u00e7\u00f5es.'}
        </span>
      ) : null}
    </div>
  );
}

export default BrandLogo;