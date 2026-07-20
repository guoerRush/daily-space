import { forwardRef, type ComponentPropsWithoutRef } from "react";
import Image from "next/image";

type MaskedHeroImageProps = ComponentPropsWithoutRef<"section">;

const maskImage = `url("data:image/svg+xml,%3Csvg width='221' height='122' viewBox='0 0 221 122' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fillRule='evenodd' clipRule='evenodd' d='M183 4C183 1.79086 184.791 0 187 0H217C219.209 0 221 1.79086 221 4V14V28V99C221 101.209 219.209 103 217 103H182C179.791 103 178 104.791 178 107V118C178 120.209 176.209 122 174 122H28C25.7909 122 24 120.209 24 118V103V94V46C24 43.7909 22.2091 42 20 42H4C1.79086 42 0 40.2091 0 38V18C0 15.7909 1.79086 14 4 14H24H43H179C181.209 14 183 12.2091 183 10V4Z' fill='%23D9D9D9'/%3E%3C/svg%3E%0A")`;

export const MaskedHeroImage = forwardRef<HTMLElement, MaskedHeroImageProps>(
  ({ className, style, ...props }, ref) => (
    <section
      ref={ref}
      aria-hidden="true"
      className={className ? `relative overflow-hidden ${className}` : "relative overflow-hidden"}
      style={{
        aspectRatio: "1213 / 667",
        backgroundColor: "#d9eadf",
        maskImage,
        WebkitMaskImage: maskImage,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
        ...style,
      }}
      {...props}
    >
      <Image
        src="https://images.unsplash.com/photo-1433838552652-f9a46b332c40?q=80&w=2070&auto=format&fit=crop"
        alt=""
        fill
        sizes="(min-width: 1024px) 304px, 100vw"
        className="absolute inset-0 size-full object-cover transition-transform duration-300 hover:scale-105"
      />
    </section>
  ),
);

MaskedHeroImage.displayName = "MaskedHeroImage";
