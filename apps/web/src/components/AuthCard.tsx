export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 w-full max-w-md sm:mt-12">
      <div className="panel p-6 sm:p-8">
        <h1 className="font-display text-2xl font-extrabold tracking-wider">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-ash">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
      {footer ? <div className="mt-4 text-center text-sm text-ash">{footer}</div> : null}
    </div>
  );
}
