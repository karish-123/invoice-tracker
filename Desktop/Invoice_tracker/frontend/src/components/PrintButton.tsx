interface Props {
  title?: string;
  label?: string;
  className?: string;
}

export default function PrintButton({ title, label = 'Print', className = 'btn-ghost text-sm' }: Props) {
  const handlePrint = () => {
    const prev = document.title;
    if (title) document.title = title;
    window.print();
    if (title) setTimeout(() => { document.title = prev; }, 0);
  };
  return (
    <button onClick={handlePrint} className={`${className} no-print`}>
      {label}
    </button>
  );
}
