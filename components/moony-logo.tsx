export function MoonyLogo({ light = false }: { light?: boolean }) {
  const ink = light ? "#fff8f1" : "#5b2f22";
  return (
    <div className="flex items-center" aria-label="MOONY">
      <span className="moony-serif text-[32px] font-normal tracking-[-0.06em] sm:text-[38px]" style={{ color: ink }}>
        M
      </span>
      <span className="relative mx-[1px] inline-grid h-[32px] w-[32px] place-items-center rounded-full border text-[13px] sm:h-[36px] sm:w-[36px]" style={{ borderColor: ink, color: ink }}>
        <span className="absolute inset-[4px] rounded-full bg-[#f2aa80]" />
        <span className="relative text-[10px]">◐</span>
      </span>
      <span className="moony-serif text-[32px] font-normal tracking-[-0.06em] sm:text-[38px]" style={{ color: ink }}>
        ONY
      </span>
    </div>
  );
}
