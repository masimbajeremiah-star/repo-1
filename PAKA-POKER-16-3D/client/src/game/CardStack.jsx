export default function CardStack({ position, color = '#ffffff' }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1.8, 0.1, 2.4]} />
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.5} />
    </mesh>
  );
}
