export default function PlayerSeat({ position, name, chips }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.8, 0.8, 0.3, 24]} />
      <meshStandardMaterial color="#3a4660" />
      <group position={[0, 0.2, 0]}>
        <mesh>
          <planeGeometry args={[1.4, 0.4]} />
          <meshStandardMaterial color="#0c1221" />
        </mesh>
      </group>
    </mesh>
  );
}
