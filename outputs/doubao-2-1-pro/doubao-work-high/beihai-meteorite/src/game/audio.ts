export class FilmAudio {
  private ctx: AudioContext | null = null;

  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq:number,duration:number,type:OscillatorType,gainValue:number,slide=0) {
    if (!this.ctx) return; const now=this.ctx.currentTime;
    const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
    osc.type=type; osc.frequency.setValueAtTime(freq,now);
    if(slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),now+duration);
    gain.gain.setValueAtTime(gainValue,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    osc.connect(gain).connect(this.ctx.destination); osc.start(now); osc.stop(now+duration);
  }
  private noise(duration:number,gainValue:number,filterFreq:number,type:BiquadFilterType='lowpass') {
    if(!this.ctx)return; const now=this.ctx.currentTime;
    const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*duration,this.ctx.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const source=this.ctx.createBufferSource(), filter=this.ctx.createBiquadFilter(), gain=this.ctx.createGain();
    source.buffer=buffer; filter.type=type; filter.frequency.value=filterFreq;
    gain.gain.setValueAtTime(gainValue,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    source.connect(filter).connect(gain).connect(this.ctx.destination); source.start(now);
  }
  ocean(){this.noise(.9,.07,420)}
  wind(){this.noise(1.4,.08,650)}
  whoosh(){this.noise(1.2,.18,1100)}
  fire(){this.noise(1.8,.18,1500)}
  explosion(){this.noise(1.6,.45,480);this.tone(42,1,.8? 'sine':'sine',.25,-20)}
  horn(){this.tone(196,1.1,'sawtooth',.12);setTimeout(()=>this.tone(165,1.2,'sawtooth',.1),250)}
  sonar(){this.tone(980,.35,'sine',.11,-500)}
  tail(){this.tone(392,1.8,'triangle',.08,220)}
}
