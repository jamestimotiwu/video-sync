// Get peer/connection fd/object
// TODO: create simplepeer object with initiator as hash/id of group
// TODO: 

// SendMessage

// Listener handler
const p = new SimplePeer({
  initiator: location.hash === '#1',
  trickle: false
})

p.on('error', err => console.log('error', err))

p.on('signal', data => {
  console.log('SIGNAL', JSON.stringify(data))
  document.querySelector('#outgoing').textContent = JSON.stringify(data)
})

document.querySelector('form').addEventListener('submit', ev => {
  ev.preventDefault()
  p.signal(JSON.parse(document.querySelector('#incoming').value))
})

p.on('connect', () => {
  console.log('CONNECT')
  p.send('whatever' + Math.random())
})

p.on('data', data => {
  console.log('data: ' + data)
})
console.log('enable test');
