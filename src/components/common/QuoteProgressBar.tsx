type QuoteStatus = 'draft' | 'closed' | 'started' | 'completed' | 'rejected';

interface QuoteProgressBarProps {
  status: QuoteStatus;
  isDeleted?: boolean;
}

function StatusIcon({ status, isDeleted }: QuoteProgressBarProps) {
  const cls = 'h-4 w-4 shrink-0';

  if (isDeleted) {
    return (
      <svg className={`${cls} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 13H6L5 7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11v6M14 11v6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7V4h6v3M4 7h16" />
      </svg>
    );
  }

  switch (status) {
    case 'draft':
      return (
        <svg className={`${cls} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'closed':
      return (
        <svg className={`${cls} text-blue-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case 'started':
      return (
        <svg className={`${cls} text-dental-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case 'completed':
      return (
        <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'rejected':
      return (
        <svg className={`${cls} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
}

export function QuoteProgressBar({ status, isDeleted }: QuoteProgressBarProps) {
  const filled = isDeleted
    ? 4
    : status === 'draft'
    ? 1
    : status === 'closed'
    ? 2
    : status === 'rejected'
    ? 2
    : status === 'started'
    ? 3
    : 4;

  const useRed = isDeleted || status === 'rejected';

  const filledColor = useRed ? 'bg-red-500' : 'bg-dental-500';
  const emptyColor = 'bg-gray-200';

  return (
    <div className="flex items-center gap-1.5">
      <StatusIcon status={status} isDeleted={isDeleted} />
      <div className="flex gap-0.5" title={`${filled}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-2.5 w-5 ${i < filled ? filledColor : emptyColor} ${
              i === 0 ? 'rounded-l-full' : ''
            } ${i === 3 ? 'rounded-r-full' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
