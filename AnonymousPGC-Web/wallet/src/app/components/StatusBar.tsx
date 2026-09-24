export function StatusBar() {
  return (
    <div className="h-11 bg-card flex items-center justify-between px-6 pt-2 text-foreground">
      <span className="text-sm font-semibold tracking-tight">9:41</span>

      <div className="flex items-center gap-2">
        <div className="flex h-3.5 items-end gap-[2px]" aria-label="Cellular signal">
          {[5, 7, 9, 11].map((height) => (
            <span
              key={height}
              className="w-[3px] rounded-full bg-foreground"
              style={{ height }}
            />
          ))}
        </div>

        <svg
          aria-label="Wi-Fi"
          viewBox="0 0 20 14"
          className="h-3.5 w-5 text-foreground"
          fill="none"
        >
          <path
            d="M2.5 4.6C6.7 1.4 13.3 1.4 17.5 4.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5.8 8C8.2 6.2 11.8 6.2 14.2 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9 11.2C9.6 10.8 10.4 10.8 11 11.2"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>

        <div className="flex items-center gap-[2px]" aria-label="Battery">
          <div className="h-3.5 w-[23px] rounded-[4px] border border-foreground/80 p-[2px]">
            <div className="h-full w-[74%] rounded-[2px] bg-foreground" />
          </div>
          <div className="h-1.5 w-[2px] rounded-r-full bg-foreground/80" />
        </div>
      </div>
    </div>
  );
}
