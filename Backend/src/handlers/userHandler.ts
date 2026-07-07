import {Server, Socket} from 'socket.io'
import { userRepository } from '../repositories/userRepository';

export default (io: Server, socket: Socket)=> {
    socket.on('login', async (username:string) => {
        if (!username) return;
        try{
            let user = await userRepository.findByUsername(username);
            let bonusGiven = false;

            if(!user){
                user = await userRepository.create(username);
                bonusGiven = true;
            } else{
                const lastLoginDate = new Date(user.last_login).toISOString().split('T')[0];
                const todayDate = new Date().toISOString().split('T')[0];

                if(lastLoginDate !== todayDate){
                    user.credits += 1000;
                    await userRepository.updateCreditsAndLogin(username,user.credits);
                    bonusGiven = true;
                }
            }
            (socket as any).username = username;
            socket.emit('loginSuccess', {username, credits: user.credits, bonusGiven});
        } catch(err){
            console.log(err)
            socket.emit('error', 'Datenbankfehler beim login');
        }
    });
    socket.on('requestLeaderboard', async () => {
        try{
            const topTen = await userRepository.getTopTen();
            socket.emit('leaderboardUpdate', topTen);
        }catch(err){
            console.log(err)
        }
    })
}