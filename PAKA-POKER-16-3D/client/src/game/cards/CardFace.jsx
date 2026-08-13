export default function CardFace({ label }) {
  return (
    <mesh castShadow>
      <boxGeometry args={[1.4, 0.02, 2.2]} />
      <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.4} />
      <group position={[0, 0.03, 0.9]}>
        <mesh>
          <planeGeometry args={[1.2, 1.6]} />
          <meshStandardMaterial color="#0d47a1" />
        </mesh>
      </group>
    </mesh>
  );
}
