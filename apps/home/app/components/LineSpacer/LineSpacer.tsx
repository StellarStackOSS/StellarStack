const LineSpacer = () => {
  return (
    <div
      className="relative h-16 w-full border-y border-white/20 bg-[#101010] md:h-20 lg:h-24"
      style={{
        backgroundImage: `repeating-linear-gradient(
                    90deg,
                    rgba(255, 255, 255, 0.2) 0px,
                    rgba(255, 255, 255, 0.2) 1px,
                    transparent 1px,
                    transparent 20px
                )`,
      }}
    />
  );
};

export default LineSpacer;
