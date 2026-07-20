"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type AnimatedContentProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  distance?: number;
  delay?: number;
};

// Adapted from the React Bits AnimatedContent component for a calm, one-time entrance.
export function AnimatedContent({ children, distance = 22, delay = 0, className, ...props }: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(element, { clearProps: "all" });
      return;
    }

    const context = gsap.context(() => {
      gsap.set(element, { autoAlpha: 0, y: distance });
      const timeline = gsap.timeline({ paused: true, delay });
      timeline.to(element, { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" });

      ScrollTrigger.create({
        trigger: element,
        start: "top 90%",
        once: true,
        onEnter: () => timeline.play(),
      });
    }, element);

    return () => context.revert();
  }, [delay, distance]);

  return <div ref={ref} className={className} {...props}>{children}</div>;
}
