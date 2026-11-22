export default function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return url ? (
    <img src={url} alt="" style={style} className="rounded-full object-cover shrink-0" />
  ) : (
    <div style={style} className="rounded-full shrink-0 grid place-items-center font-bold bg-brand-soft text-brand-ink">
      {initials}
    </div>
  );
}
