import React, { useEffect, useMemo, useRef, useState } from 'react'

const clamp = (x, min, max) => Math.max(min, Math.min(max, x))

const defaultPreset = {
  name: 'Default',
  version: 1,
  mapping: { transpose: 0, velMin: 1, velMax: 127, gamma: 1.0 },
  thru: true,
}

export default function App(){
  const [supported, setSupported] = useState('requestMIDIAccess' in navigator)
  const [access, setAccess] = useState(null)
  const [inputs, setInputs] = useState([])
  const [outputs, setOutputs] = useState([])
  const [inId, setInId] = useState('')
  const [outId, setOutId] = useState('')
  const [thru, setThru] = useState(defaultPreset.thru)
  const [transpose, setTranspose] = useState(defaultPreset.mapping.transpose)
  const [velMin, setVelMin] = useState(defaultPreset.mapping.velMin)
  const [velMax, setVelMax] = useState(defaultPreset.mapping.velMax)
  const [gamma, setGamma] = useState(defaultPreset.mapping.gamma)
  const [midiOk, setMidiOk] = useState(false)
  const [name, setName] = useState(defaultPreset.name)
  const monRef = useRef(null)
  const activeMapRef = useRef(new Map()) // originalNote->transposedNote for NoteOff
  const inputRef = useRef(null)
  const outputRef = useRef(null)

  // attach MIDI
  useEffect(()=>{
    if(!supported) return
    navigator.requestMIDIAccess({ sysex:false })
      .then(acc=>{
        setAccess(acc)
        setMidiOk(true)
        const updateDevs = () => {
          const ins = [...acc.inputs.values()]
          const outs = [...acc.outputs.values()]
          setInputs(ins); setOutputs(outs)
          if(!inId && ins[0]) setInId(ins[0].id)
          if(!outId && outs[0]) setOutId(outs[0].id)
        }
        updateDevs()
        acc.onstatechange = updateDevs
      })
      .catch(err=>{ console.error(err); setMidiOk(false)})
  }, [supported])

  // bind selected IO
  useEffect(()=>{
    if(!access) return
    // clear prior
    if(inputRef.current) inputRef.current.onmidimessage = null
    inputRef.current = null
    outputRef.current = null
    if(inId && access.inputs.has(inId)) inputRef.current = access.inputs.get(inId)
    if(outId && access.outputs.has(outId)) outputRef.current = access.outputs.get(outId)
    if(inputRef.current) inputRef.current.onmidimessage = onMidiMessage
  }, [access, inId, outId])

  function log(line){
    const m = monRef.current
    if(!m) return
    const div = document.createElement('div')
    div.textContent = line
    div.className = 'line'
    m.prepend(div)
    while(m.childNodes.length>240) m.removeChild(m.lastChild)
  }

  function send(out, data, whenMs=0){
    if(!out) return
    out.send(data, window.performance.now()+Math.max(0,whenMs))
  }

  function applyVelocity(v){
    // normalize 0..1
    let x = clamp(v,1,127) / 127
    // gamma curve: <1=concave (softer), >1=convex (harder)
    x = Math.pow(x, clamp(gamma, 0.4, 2.5))
    // scale to [velMin, velMax]
    const out = Math.round(velMin + x * (velMax - velMin))
    return clamp(out, 1, 127)
  }

  function onMidiMessage(e){
    if(!thru) return // monitor-only mode
    const out = outputRef.current
    const [status, d1, d2] = e.data
    const cmd = status & 0xf0
    const ch  = status & 0x0f
    if(cmd===0x90 && d2>0){
      const noteOut = clamp(d1 + transpose, 0, 127)
      const velOut = applyVelocity(d2)
      activeMapRef.current.set(d1, noteOut)
      send(out, [0x90|ch, noteOut, velOut])
      log(`IN ch${ch+1} NoteOn n${d1} v${d2} → OUT n${noteOut} v${velOut}`)
    } else if(cmd===0x80 || (cmd===0x90 && d2===0)){
      const noteOut = activeMapRef.current.get(d1) ?? clamp(d1 + transpose, 0, 127)
      send(out, [0x80|ch, noteOut, d2])
      activeMapRef.current.delete(d1)
      log(`IN ch${ch+1} NoteOff n${d1} → OUT n${noteOut}`)
    } else if(cmd===0xB0 || cmd===0xE0 || cmd===0xD0){
      // CC / PitchBend / Aftertouch pass-through unchanged
      if(cmd===0xD0) send(out,[status,d1])
      else send(out, [status,d1,d2])
      log(`IN ch${ch+1} Other ${status.toString(16)} [${d1},${d2}] → thru`)
    } else {
      // Just pass
      send(out, e.data)
    }
  }

  function onRefresh(){
    if(!access) return
    const ins=[...access.inputs.values()]; const outs=[...access.outputs.values()]
    setInputs(ins); setOutputs(outs)
    log(`Devices refreshed (IN:${ins.length} OUT:${outs.length})`)
  }

  function panic(){
    const out = outputRef.current
    if(!out) return
    for(let ch=0; ch<16; ch++) send(out, [0xB0|ch,123,0])
    log('🧯 Panic: All Notes Off sent on all channels')
  }

  function exportJson(){
    const preset = {
      name, version: 1,
      mapping: { transpose, velMin, velMax, gamma },
      thru, device: { inId, outId }
    }
    const blob = new Blob([JSON.stringify(preset,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g,'-')
    a.href = url
    a.download = `chorda-mvp-preset-${ts}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    log('💾 Exported preset JSON')
  }

  function importJson(ev){
    const file = ev.target.files?.[0]; if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try{
        const obj = JSON.parse(reader.result)
        setName(obj.name || 'Imported')
        const m = obj.mapping || {}
        setTranspose(clamp(+m.transpose||0,-24,24))
        setVelMin(clamp(+m.velMin||1,1,127))
        setVelMax(clamp(+m.velMax||127,1,127))
        setGamma(clamp(+m.gamma||1,0.4,2.5))
        if(obj.thru!==undefined) setThru(!!obj.thru)
        if(obj.device){
          if(obj.device.inId) setInId(obj.device.inId)
          if(obj.device.outId) setOutId(obj.device.outId)
        }
        log('📥 Imported preset JSON')
      }catch(e){
        alert('匯入失敗：JSON 格式錯誤'); console.error(e)
      }
      ev.target.value = ''
    }
    reader.readAsText(file, 'utf-8')
  }

  const midiStatusPill = midiOk ? 'pill pill-ok' : 'pill pill-warn'

  return (
    <div className="wrap">
      <div className="row">
        <div className="h1">Chorda Control Hub — Sprint 1 (MVP)</div>
        <span className={midiStatusPill}>{supported? (midiOk?'MIDI: 就緒':'MIDI: 初始化中/失敗') : 'MIDI: 瀏覽器不支援'}</span>
        <span className="pill right">v0.1</span>
      </div>

      <div className="card">
        <div className="row">
          <div style={{flex:1}}>
            <label>輸入（Chorda）</label>
            <select value={inId} onChange={e=>setInId(e.target.value)}>
              {inputs.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label>輸出（合成器 / DAW / 虛擬裝置）</label>
            <select value={outId} onChange={e=>setOutId(e.target.value)}>
              {outputs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <button onClick={onRefresh}>重新掃描裝置</button>
          <label className="row" style={{gap:6}}>
            <input type="checkbox" checked={thru} onChange={e=>setThru(e.target.checked)} />
            <span>啟用橋接（接收→處理→送出）</span>
          </label>
          <button className="danger" onClick={panic}>Panic（All Notes Off）</button>
        </div>
      </div>

      <div className="card">
        <div className="grid3">
          <div>
            <label>Preset 名稱</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} />
          </div>
          <div>
            <label>匯出 / 匯入 Preset（JSON）</label>
            <div className="row">
              <button onClick={exportJson}>匯出 JSON</button>
              <label className="row" style={{gap:6}}>
                <input type="file" accept=".json" onChange={importJson} />
              </label>
            </div>
            <div className="small">匯出檔包含：Transpose、Velocity Curve、橋接、裝置 ID。</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid3">
          <div>
            <label>Transpose（半音 -24 … +24）</label>
            <input type="number" min={-24} max={24} value={transpose} onChange={e=>setTranspose(clamp(+e.target.value,-24,24))} />
          </div>
          <div>
            <label>Velocity 最小/最大</label>
            <div className="row">
              <input type="number" min={1} max={127} value={velMin} onChange={e=>setVelMin(clamp(+e.target.value,1,127))} />
              <input type="number" min={1} max={127} value={velMax} onChange={e=>setVelMax(clamp(+e.target.value,1,127))} />
            </div>
            <div className="small">映射前會先經過曲線，再縮放到此區間。</div>
          </div>
          <div>
            <label>Velocity 曲線 γ（0.4 … 2.5）</label>
            <input type="range" min={0.4} max={2.5} step={0.01} value={gamma} onChange={e=>setGamma(+e.target.value)} />
            <div className="small">γ &lt; 1：柔（Concave）；γ = 1：線性；γ &gt; 1：硬（Convex）。目前：{gamma.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <label>MIDI Monitor</label>
        <div ref={monRef} className="monitor"></div>
      </div>

      <div className="row small">
        <span>© 2025 Chorda Control Hub — Sprint 1 (MVP)</span>
        <span className="right">建議使用 Chrome / Edge（桌面版）</span>
      </div>
    </div>
  )
}
