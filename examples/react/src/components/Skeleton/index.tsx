export function Skeleton({ height, width }: { height: number | string; width?: number | string }) {
  return (
    <div className="animate-pulse flex flex-col gap-10" style={{ width }}>
      <div className="flex justify-between">
        <div className="bg-tertiary rounded w-full" style={{ height }} />
      </div>
    </div>
  );
}
