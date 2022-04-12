import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { PreChatComponent } from './pre-chat/pre-chat.component';


const routes: Routes = [
  { path: '', component: ChatComponent},
  { path: 'meeting', component: ChatComponent},
  { path: 'meeting/client', component : PreChatComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
