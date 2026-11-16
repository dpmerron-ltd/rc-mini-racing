export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function normalizeAxis(value, neutral, negative, positive, deadzone = 0.05) {
  const delta = value - neutral;
  const end = delta * (positive - neutral) >= 0 ? positive : negative;
  const span = Math.abs(end - neutral);
  if (span < 0.03) return 0;
  const magnitude = clamp(Math.abs(delta) / span, 0, 1);
  return magnitude <= deadzone ? 0 : Math.sign(delta * (positive - neutral)) * (magnitude - deadzone) / (1 - deadzone);
}

// Positive expo softens centre response; negative expo sharpens it.
// Both directions retain neutral and full travel exactly.
export function steeringExpo(value, expo) {
  const x=clamp(value,-1,1),e=clamp(expo,-1,1);
  const curve=e>=0?x**3:Math.sign(x)*(1-(1-Math.abs(x))**3);
  return x*(1-Math.abs(e))+curve*Math.abs(e);
}

export function applyEndpoints(input, endpoints) {
  const steer=clamp(input.steer,-1,1),throttle=clamp(input.throttle,-1,1);
  return {
    steer: steer * clamp(steer<0?endpoints.left:endpoints.right,.25,1.25),
    throttle: throttle * clamp(throttle<0?endpoints.brake:endpoints.throttle,0,1),
  };
}

export function updateSteering(car, input, dt) {
  const target=clamp(input,-1.25,1.25)*.39;
  const unwinding=target*car.steering<=0 || Math.abs(target)<Math.abs(car.steering);
  const servoRate=unwinding?10:3.7;
  car.steering+=clamp(target-car.steering,-servoRate*dt,servoRate*dt);
}

// A rear-driven, short-wheelbase car with separate front/rear tyre forces.
// Metres, seconds, kilograms. Parameters are tunable estimates, not measured chassis data.
export const vehicle = { mass: 0.78, wheelbase: 0.176, front: 0.097, rear: 0.079, inertia: 0.0048, grip: 1.12 };
export function stepCar(car, control, dt) {
  car.yawRate ??= 0; car.acceleration ??= 0; car.lateralAcceleration ??= 0;
  const n = Math.max(1, Math.ceil(dt / (1 / 480))), h = dt / n;
  for (let j = 0; j < n; j++) {
    const { mass:m, front:a, rear:b, wheelbase:L, inertia:I, grip:mu } = vehicle;
    const sin = Math.sin(car.heading), cos = Math.cos(car.heading);
    let u = car.vx * sin + car.vz * cos;
    let v = -car.vx * cos + car.vz * sin;
    const demand = clamp(control.throttle, -1, 1);
    updateSteering(car,control.steer,h);
    const delta = car.steering;
    let drive = demand >= 0 ? demand * 6.2 * Math.max(0, 1 - Math.max(0,u)/11.5) : demand * (u > .12 ? 4.8 : 1.65);
    if(u < -1.3 && demand < 0) drive = 0;
    const drag = .065*u + .012*u*Math.abs(u) + .075*Math.tanh(u*12);
    const transfer = clamp(m * car.acceleration * .024 / L, -m*9.81*.22, m*9.81*.22);
    const frontLoad = m*9.81*b/L - transfer, rearLoad = m*9.81*a/L + transfer;
    const rearGrip=mu*1.15*rearLoad;
    drive = clamp(drive, -rearGrip, rearGrip);
    const frontLimit = mu*1.06*frontLoad;
    const rearLimit = Math.sqrt(Math.max(.1,rearGrip**2-drive**2));
    const speed = Math.max(.65,Math.abs(u));
    const frontSlip = delta * Math.sign(u || 1) - Math.atan2(v + a*car.yawRate, speed);
    const rearSlip = -Math.atan2(v - b*car.yawRate, speed);
    const frontForce = frontLimit*Math.tanh(23*frontSlip/frontLimit)*Math.min(1,Math.abs(u)/.5);
    const rearForce = rearLimit*Math.tanh(24*rearSlip/rearLimit);
    const longitudinal = (drive-drag-frontForce*Math.sin(delta))/m;
    const lateral = (frontForce*Math.cos(delta)+rearForce)/m;
    let yawAccel = (a*frontForce*Math.cos(delta)-b*rearForce-.006*car.yawRate)/I;
    const slow = clamp((.7-Math.abs(u))/.7,0,1);
    const slowYaw = u / L * Math.tan(delta);
    yawAccel = yawAccel*(1-slow) + (slowYaw-car.yawRate)*28*slow;
    car.yawRate += yawAccel*h;
    // World-space force integration preserves momentum as the body rotates.
    car.vx += (sin*longitudinal-cos*lateral)*h;
    car.vz += (cos*longitudinal+sin*lateral)*h;
    if(slow>0) { const damping=Math.exp(-24*slow*h); v*=damping; const nextU=car.vx*sin+car.vz*cos; car.vx=sin*nextU-cos*v;car.vz=cos*nextU+sin*v; }
    car.heading -= car.yawRate*h;
    car.x += car.vx*h; car.z += car.vz*h;
    car.acceleration += (longitudinal-car.acceleration)*Math.min(1,h*18);
    car.lateralAcceleration += (lateral-car.lateralAcceleration)*Math.min(1,h*18);
    car.speed = car.vx*Math.sin(car.heading)+car.vz*Math.cos(car.heading);
  }
}

export function nearestTrack(x, z, points) {
  let best = { distance: Infinity, x: 0, z: 0, progress: 0 };
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance) best = { distance, x: px, z: pz, progress: (i + t) / points.length };
  }
  return best;
}

export function constrainToTrack(car, points, halfWidth) {
  const nearest = nearestTrack(car.x, car.z, points);
  const limit = halfWidth - 0.085;
  if (nearest.distance > limit) {
    const nx = (car.x - nearest.x) / nearest.distance, nz = (car.z - nearest.z) / nearest.distance;
    car.x = nearest.x + nx * limit; car.z = nearest.z + nz * limit;
    const outward = car.vx * nx + car.vz * nz;
    if (outward > 0) {
      // Hard plastic: elastic normal reflection, no artificial speed penalty or wall friction.
      car.vx -= 2 * outward * nx;
      car.vz -= 2 * outward * nz;
      car.speed = car.vx*Math.sin(car.heading||0)+car.vz*Math.cos(car.heading||0);
    }
  }
  return nearest.progress;
}

export class LapCounter {
  constructor() { this.reset(); }
  reset() { this.next = 1; this.elapsed = 0; this.laps = 0; this.best = null; this.last = null; this.previous = 0; }
  update(progress, dt) {
    this.elapsed += dt;
    let delta = progress - this.previous;
    if (delta < -0.5) delta += 1;
    if (delta > 0.5) delta -= 1;
    const forward = delta > 0 && delta < 0.1;
    let completed = false;
    if (forward) {
      if (this.next < 8 && progress >= this.next / 8 && progress < (this.next + 1) / 8) this.next++;
      if (this.next === 8 && this.previous > 0.9 && progress < 0.1) {
        this.last = this.elapsed; this.best = this.best === null ? this.last : Math.min(this.best, this.last);
        this.laps++; this.elapsed = 0; this.next = 1; completed = true;
      }
    }
    this.previous = progress;
    return completed;
  }
}
