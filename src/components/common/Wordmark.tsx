/** Two-tone product name: Tarang in ink, Chakra in the brand orange. */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-foreground">Tarang</span>
      <span className="text-primary">Chakra</span>
    </span>
  );
}
