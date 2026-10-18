/**
 * 输入层：指针锁定、键位表、鼠标增量与按键状态。
 * 鼠标增量在每次被读取后清零，保证与渲染帧一一对应。
 */
export class Input {
  readonly keys = new Set<string>();
  private downKeys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  primaryHeld = false;
  secondaryHeld = false;
  private clickQueue: number[] = [];

  attach(el: HTMLElement): () => void {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = normalize(e.code);
      if (!this.keys.has(k)) this.downKeys.add(k);
      this.keys.add(k);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = normalize(e.code);
      this.keys.delete(k);
      this.downKeys.delete(k);
    };
    const onBlur = () => {
      this.keys.clear();
      this.downKeys.clear();
      this.primaryHeld = false;
      this.secondaryHeld = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!this.locked) return;
      if (e.button === 0) {
        this.primaryHeld = true;
        this.clickQueue.push(0);
      }
      if (e.button === 2) this.secondaryHeld = true;
      e.preventDefault();
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) this.primaryHeld = false;
      if (e.button === 2) this.secondaryHeld = false;
    };
    const onWheel = (e: WheelEvent) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    };
    const onContext = (e: Event) => e.preventDefault();
    const onLockChange = () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) {
        this.keys.clear();
        this.downKeys.clear();
        this.primaryHeld = false;
        this.secondaryHeld = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('contextmenu', onContext);
    document.addEventListener('pointerlockchange', onLockChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContext);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }

  requestLock(el: HTMLElement): void {
    // 部分浏览器返回 Promise，可能因缺少用户手势而 reject，这里吞掉以免产生未处理拒绝
    const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }

  /** 消费本帧的鼠标增量（像素）。 */
  takeMouse(): { dx: number; dy: number } {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** 本帧新按下的键（用于切枪、下包等边沿触发动作）。 */
  consumePressed(): string[] {
    const out = Array.from(this.downKeys);
    this.downKeys.clear();
    return out;
  }

  isDown(k: string): boolean {
    return this.keys.has(k);
  }
}

function normalize(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'shift';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'ctrl';
  if (code === 'Space') return 'space';
  return code.toLowerCase();
}
