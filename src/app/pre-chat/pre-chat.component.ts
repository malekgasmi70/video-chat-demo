import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { environment } from 'src/environments/environment';
import { DataService } from '../chat/service/data.service';
import { Message } from '../chat/types/message';

export const ENV_RTCPeerConfiguration = environment.RTCPeerConfiguration;


const mediaConstraints = {
  audio: true,
  video: {width: 1280, height: 720}
  // video: {width: 1280, height: 720} // 16:9
  // video: {width: 960, height: 540}  // 16:9
  // video: {width: 640, height: 480}  //  4:3
  // video: {width: 160, height: 120}  //  4:3
};

@Component({
  selector: 'app-pre-chat',
  templateUrl: './pre-chat.component.html',
  styleUrls: ['./pre-chat.component.css']
})
export class PreChatComponent implements AfterViewInit {

  @ViewChild('local_video') localVideo: ElementRef;
  @ViewChild('received_video') remoteVideo: ElementRef;

  private localStream: MediaStream;
  localVideoActive: boolean;
  inCall : boolean = false;
  peerConnection : RTCPeerConnection;
  
  constructor(private dataService : DataService) { }

  ngAfterViewInit(): void {
    this.addIncomingMessageHandler();
    this.requestMediaDevices();
  }
  
  addIncomingMessageHandler() : void {
    this.dataService.connect();

    this.dataService.messages$.subscribe(
      msg => {
        switch(msg.type) {
          case 'offer':
            this.inCall = true;
            this.handleOfferMessage(msg.data);
            break;
          case 'answer':
            this.inCall = true;
            this.handleOfferMessage(msg.data);
            break;
          case 'hangup':
            this.inCall = true;
            this.handleHangupMessage(msg);
            break;
          case 'ice-candidate':
            this.inCall = true;
            this.handleICECandidateMessage(msg.data);
            break;
          default:
            console.log('Unkown message of type ' + msg.type);
        }
      },
      error => console.log(error)
    );
  }

  private handleICECandidateMessage(msg : RTCIceCandidate) : void {
    const candidate = new RTCIceCandidate(msg);
    this.peerConnection.addIceCandidate(candidate).catch(this.reportError);
  }

  private reportError = (e: Error) => {
    console.log(`got error: ${e.name}`);
    console.log(e);
  }

  private handleHangupMessage(msg: Message) : void {
    console.log(msg);
    this.closeVideoCall();
  }

  private closeVideoCall() : void {
    console.log('closing call');

    if (this.peerConnection) {
      console.log('--> Closing the peer connection.');

      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.onsignalingstatechange = null;

      this.peerConnection.getTransceivers().forEach(transceiver => {
        transceiver.stop();
      });

      this.peerConnection.close();
      this.peerConnection = null;

      this.inCall = false;
    }
  }

  private handleOfferMessage(msg : RTCSessionDescriptionInit) : void {
    console.log('handle incoming offer');
    if(!this.peerConnection) {
      this.createPeerConnection();
    }

    if(!this.localStream) {
      this.startLocalVideo();
    }

    this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg))
    .then(() => {
      this.localVideo.nativeElement.srcObject = this.localStream;

      this.localStream.getTracks().forEach(
        track => this.peerConnection.addTrack(track, this.localStream)
      );
    }).then(() => {
      return this.peerConnection.createAnswer();
    }).then((answer) => {
      return this.peerConnection.setLocalDescription(answer);
    }).then(() => {
      this.dataService.sendMessage({type: 'answer', data: this.peerConnection.localDescription});
      this.inCall = true;
    }).catch(this.handleGetUserMediaError);
  }

  hangUp(): void {
    this.dataService.sendMessage({type: 'hangup', data: ''});
    this.closeVideoCall();
  }
  
  private handleGetUserMediaError(e: Error): void {
    switch (e.name) {
      case 'NotFoundError':
        alert('Unable to open your call because no camera and/or microphone were found.');
        break;
      case 'SecurityError':
      case 'PermissionDeniedError':
        // Do nothing; this is the same as the user canceling the call.
        break;
      default:
        console.log(e);
        alert('Error opening your camera and/or microphone: ' + e.message);
        break;
    }

    this.closeVideoCall();
  }

  

  private async requestMediaDevices() : Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      this.pauseLocalVideo();
    } catch(e) {
      console.error(e);
      alert(`getUserMedia() error: ${e.name}`);
    }
  }

  startLocalVideo() : void {
    console.log('starting locat stream');
    this.localStream.getTracks().forEach(track => {
      track.enabled = true;
    });
    this.localVideo.nativeElement.srcObject = this.localStream;
    this.localVideoActive = true;
  }

  pauseLocalVideo() {
    console.log('pause local stream');
    this.localStream.getTracks().forEach(track => {
      track.enabled = false;
    });
    this.localVideo.nativeElement.srcObject = undefined;
    this.localVideoActive = false;
  }

  private createPeerConnection(): void {
    console.log('creating PeerConnection...');
    this.peerConnection = new RTCPeerConnection(ENV_RTCPeerConfiguration);
  
    this.peerConnection.onicecandidate = this.handleICECandidateEvent;
    this.peerConnection.oniceconnectionstatechange = this.handleICEConnectionStateChangeEvent;
    this.peerConnection.onsignalingstatechange = this.handleSignalingStateChangeEvent;
    this.peerConnection.ontrack = this.handleTrackEvent;
  }

  private handleICECandidateEvent = (event: RTCPeerConnectionIceEvent) => {
    console.log(event);
    if (event.candidate) {
      this.dataService.sendMessage({
        type: 'ice-candidate',
        data: event.candidate
      });
    }
  }

  private handleICEConnectionStateChangeEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.iceConnectionState) {
      case 'closed':
      case 'failed':
      case 'disconnected':
        this.closeVideoCall();
        break;
    }
  }

  private handleSignalingStateChangeEvent = (event: Event) => {
    console.log(event);
    switch (this.peerConnection.signalingState) {
      case 'closed':
        this.closeVideoCall();
        break;
    }
  }

  private handleTrackEvent = (event: RTCTrackEvent) => {
    console.log(event);
    this.remoteVideo.nativeElement.srcObject = event.streams[0];
  }
}
