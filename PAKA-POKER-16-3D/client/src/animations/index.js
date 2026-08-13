const ease = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    }
    if (t < 2 / 2.75) {
      t -= 1.5 / 2.75;
      return 7.5625 * t * t + 0.75;
    }
    if (t < 2.5 / 2.75) {
      t -= 2.25 / 2.75;
      return 7.5625 * t * t + 0.9375;
    }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPropertyValue = (target, property) => {
  if (!target || !property) return undefined;
  return property.split('.').reduce((obj, key) => obj?.[key], target);
};

const setPropertyValue = (target, property, value) => {
  if (!target || !property) return;
  const fields = property.split('.');
  const last = fields.pop();
  const parent = fields.reduce((obj, key) => obj?.[key], target);
  if (parent && last) parent[last] = value;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const animate = ({
  duration = 300,
  easing = ease.linear,
  onUpdate,
  onComplete,
}) => {
  let animationFrame = null;
  let startTimestamp = null;
  let stopped = false;

  const step = (timestamp) => {
    if (stopped) return;
    if (startTimestamp === null) startTimestamp = timestamp;
    const elapsed = timestamp - startTimestamp;
    const progress = clamp(elapsed / duration, 0, 1);
    const eased = easing(progress);
    if (onUpdate) onUpdate(eased, progress, elapsed);
    if (elapsed < duration) {
      animationFrame = window.requestAnimationFrame(step);
    } else {
      if (onComplete) onComplete();
    }
  };

  return {
    start: () => {
      stopped = false;
      startTimestamp = null;
      animationFrame = window.requestAnimationFrame(step);
    },
    stop: () => {
      stopped = true;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    },
  };
};

export const tweenValue = ({
  from,
  to,
  duration = 300,
  easing = ease.linear,
  onUpdate,
  onComplete,
}) => {
  const delta = to - from;
  return animate({
    duration,
    easing,
    onUpdate: (eased) => {
      if (onUpdate) onUpdate(from + delta * eased);
    },
    onComplete,
  });
};

export const animateElementStyle = ({
  element,
  property,
  from,
  to,
  duration = 300,
  easing = ease.linear,
  unit = '',
  onComplete,
}) => {
  const animation = tweenValue({
    from,
    to,
    duration,
    easing,
    onUpdate: (value) => {
      if (element && property) {
        element.style[property] = `${value}${unit}`;
      }
    },
    onComplete,
  });
  if (element) animation.start();
  return animation;
};

export const animateOpacity = ({
  element,
  from = 0,
  to = 1,
  duration = 300,
  easing = ease.linear,
  onComplete,
}) => animateElementStyle({
  element,
  property: 'opacity',
  from,
  to,
  duration,
  easing,
  unit: '',
  onComplete,
});

export const animateTransform = ({
  element,
  from = 0,
  to = 1,
  transform = 'scale',
  duration = 300,
  easing = ease.linear,
  onComplete,
}) => animateElementStyle({
  element,
  property: 'transform',
  from,
  to,
  duration,
  easing,
  unit: '',
  onComplete,
});

export const animateObjectProperty = ({
  target,
  property,
  from,
  to,
  duration = 300,
  easing = ease.linear,
  onUpdate,
  onComplete,
}) => {
  const delta = to - from;
  return animate({
    duration,
    easing,
    onUpdate: (eased) => {
      const value = from + delta * eased;
      if (target && property) {
        target[property] = value;
      }
      if (onUpdate) onUpdate(value);
    },
    onComplete,
  });
};

export const animateThreeProperty = ({
  object3D,
  property,
  from,
  to,
  duration = 300,
  easing = ease.linear,
  onUpdate,
  onComplete,
}) => {
  const animation = animateObjectProperty({
    target: object3D,
    property,
    from,
    to,
    duration,
    easing,
    onUpdate: (value) => {
      if (object3D && property) {
        setPropertyValue(object3D, property, value);
      }
      if (onUpdate) onUpdate(value);
    },
    onComplete,
  });
  animation.start();
  return animation;
};

export const animateThreeVector3 = ({
  vector3,
  from,
  to,
  duration = 300,
  easing = ease.linear,
  onUpdate,
  onComplete,
}) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const deltaZ = to.z - from.z;

  const animation = animate({
    duration,
    easing,
    onUpdate: (eased) => {
      const x = from.x + deltaX * eased;
      const y = from.y + deltaY * eased;
      const z = from.z + deltaZ * eased;
      if (vector3) {
        vector3.set(x, y, z);
      }
      if (onUpdate) onUpdate({ x, y, z });
    },
    onComplete,
  });

  animation.start();
  return animation;
};

export const animateGSAP = async ({ target, vars }) => {
  try {
    const { gsap } = await import('gsap');
    return gsap.to(target, vars);
  } catch (error) {
    throw new Error('GSAP is not installed or could not be loaded. Install gsap to use animateGSAP.');
  }
};

export const gsapTimeline = async ({ defaults }) => {
  try {
    const { gsap } = await import('gsap');
    return gsap.timeline({ defaults });
  } catch (error) {
    throw new Error('GSAP is not installed or could not be loaded. Install gsap to use gsapTimeline.');
  }
};

export const createStateMachine = ({ initialState, transitions }) => {
  let currentState = initialState;

  const can = (event) => {
    const next = transitions[currentState]?.[event];
    return next !== undefined;
  };

  const transition = (event, payload) => {
    const nextState = transitions[currentState]?.[event];
    if (!nextState) {
      throw new Error(`Invalid transition from ${currentState} using ${event}`);
    }
    currentState = typeof nextState === 'function' ? nextState(payload) : nextState;
    return currentState;
  };

  return {
    get state() {
      return currentState;
    },
    can,
    transition,
  };
};

export const sequence = async (steps = []) => {
  for (const step of steps) {
    if (typeof step === 'function') {
      const result = step();
      if (result instanceof Promise) {
        await result;
      }
    } else if (step?.duration) {
      await sleep(step.duration);
    }
  }
};

export const parallel = async (steps = []) => {
  await Promise.all(
    steps.map((step) => {
      if (typeof step === 'function') return step();
      if (step?.duration) return sleep(step.duration);
      return Promise.resolve();
    }),
  );
};

export const animateElementSequence = async ({ element, keyframes, duration = 300, easing = ease.linear }) => {
  for (const frame of keyframes) {
    await new Promise((resolve) => {
      animate({
        duration: frame.duration ?? duration,
        easing,
        onUpdate: (value) => {
          Object.entries(frame.properties || {}).forEach(([property, [from, to]]) => {
            const current = from + (to - from) * value;
            element.style[property] = typeof current === 'number' ? `${current}${frame.unit || ''}` : current;
          });
        },
        onComplete: resolve,
      }).start();
    });
  }
};

export const animationHelpers = {
  ease,
  sleep,
  animate,
  tweenValue,
  animateElementStyle,
  animateOpacity,
  animateTransform,
  animateObjectProperty,
  animateThreeProperty,
  animateThreeVector3,
  animateGSAP,
  gsapTimeline,
  createStateMachine,
  sequence,
  parallel,
  animateElementSequence,
};
