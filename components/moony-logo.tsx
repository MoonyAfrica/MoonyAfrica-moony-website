export function MoonyLogo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  const ink = light ? "#fff9f3" : "#5b2f22";
  const ring = light ? "rgba(255,249,243,.72)" : "rgba(91,47,34,.48)";

  return (
    <div className="inline-flex items-center select-none" aria-label="MOONY">
      <span
        className={`moony-logo-type moony-serif font-normal leading-none ${compact ? "text-[29px]" : "text-[34px] sm:text-[39px]"}`}
        style={{ color: ink }}
      >
        M
      </span>

      <span className={`relative -mx-[2px] inline-grid place-items-center ${compact ? "h-[31px] w-[31px]" : "h-[36px] w-[36px] sm:h-[40px] sm:w-[40px]"}`}>
        <span className="absolute inset-[2px] rounded-full bg-[#f1a276]" />
        <span className="absolute -inset-[7px] rounded-full border" style={{ borderColor: ring }} />
        <span className="absolute -inset-[10px] rotate-[18deg] rounded-full border border-dashed" style={{ borderColor: ring }} />
        <svg viewBox="0 0 40 40" className="relative h-[78%] w-[78%]" aria-hidden="true">
          <circle cx="16" cy="11" r="3.2" fill="#b9633f" />
          <path d="M15.5 15.2c3.9-2.7 7.5-1.7 9.5 1.5 1.2 2 1.7 4.2 4.9 6.6-3.7.6-6.3-.7-8.2-2.8-1.5 3.1-4.1 5.8-8.2 8.4-2.2 1.4-4.5 1.7-6.9.9 4-2.2 6.3-5 7.2-8.4.6-2.2.1-4.2 1.7-6.2Z" fill="#a85135" />
          <path d="M17.3 18.1c-1.7 2.6-2.4 5.7-2 9.3 1.7-.8 3.2-1.9 4.5-3.2-1-1.8-1.8-3.8-2.5-6.1Z" fill="#8e402d" opacity=".82" />
          <path d="M11.8 14.4c-2.1-1.2-3.2-3-3.4-5.4 2.3 1.2 4.1 2.5 5.2 4" fill="none" stroke="#9b4830" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>

      <span
        className={`moony-logo-type moony-serif font-normal leading-none ${compact ? "text-[29px]" : "text-[34px] sm:text-[39px]"}`}
        style={{ color: ink }}
      >
        ONY
      </span>
    </div>
  );
}
