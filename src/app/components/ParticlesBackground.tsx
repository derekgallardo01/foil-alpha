'use client';

import React, { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Engine } from 'tsparticles-engine'; // Import types from tsparticles-engine

const Particles = dynamic(() => import('react-tsparticles'), {
  ssr: false,
});

const ParticlesBackground = () => {
  const particlesInit = useCallback(async (engine: Engine) => {
    await tsParticles.load('tsparticles', engine); // Initialize particles with container ID
  }, []);

  const particlesLoaded = useCallback(async () => {
    // Removed unused container parameter
  }, []);

  const particlesOptions = {
    particles: {
      number: {
        value: 100,
      },
      size: {
        value: 3,
      },
      move: {
        speed: 1,
        direction: 'none',
      },
    },
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
      <Particles
        id="tsparticles"
        init={particlesInit}
        loaded={particlesLoaded}
        options={particlesOptions}
      />
    </div>
  );
};

export default ParticlesBackground;