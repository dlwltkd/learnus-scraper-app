(function() {
    require.config({
        enforceDefine: false,
        paths: {
            // Vendor code.
            socketio: "https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io",
        }
    });
})();

define(
    [
        'jquery',
        'socketio'
    ],
    function(
        $,
        io
    ) {

        var learningCheckerV2 = {
            player: null
        };

        learningCheckerV2.init = function(token, player) {
            learningCheckerV2.player = player;

            var socket = null;
            var domain = document.domain;
            console.log(domain)
            /*
                http : 26000 ~ 26100
                https : 28000 ~ 28100
            */

            switch(domain){
                case "lms.chungbuk.ac.kr":
                case "lms.snue.ac.kr":
                case "lms.yeonsung.ac.kr":
                case "online.kbu.ac.kr":
                case "ymooc.yeonsung.ac.kr":
                case "lms.cha.ac.kr":
                    socket = io('//lc.coursemos.kr:28021', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                case "plato.pusan.ac.kr": // SSL 적용 필요
                case "lms.xr.ac.kr":
                case "dllms.daelim.ac.kr":                    
                case "nblms.nambu.ac.kr":
                case "k-class.korea.ac.kr":
                case "nlms.dhc.ac.kr":
                case "mooc.dongguk.edu":
                    socket = io('//lc.coursemos.kr:28024', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                case "learn.inha.ac.kr": // SSL 적용 필요
                case "sel.jnu.ac.kr": // 전남대학교
                case "mstlms.daelim.ac.kr":
                case "class.ust.ac.kr": //과학기술연합대학교
                case "smartlead.hallym.ac.kr":
                case "sgulms.songgok.ac.kr" :
                    socket = io('//lc.coursemos.kr:28030', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                case "cyber.jj.ac.kr": // SSL 적용 필요
                case "cyber.gimcheon.ac.kr": // SSL 적용 필요
                case "csms39.moodler.kr": // SSL - 국민대학교
                case "plms.postech.ac.kr": // SSL - postech
                case "eclass2.dongguk.edu":
                case "csms39a.moodler.kr":
                    socket = io('//lc.coursemos.kr:28031', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;                
                case "ecampus.changwon.ac.kr": // SSL - 창원대학교
                case "open.yonsei.ac.kr": // SSL - 연세대학교
                case "ecampus.dscu.ac.kr":
                case "kihalms.moodler.kr":
                case "cyber.anyang.ac.kr":
                case "klass545.kyungmin.ac.kr":
                case "splus-lms.sogang.ac.kr":
                    socket = io('//lc.coursemos.kr:28032', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                case "ecampus.kookmin.ac.kr": // SSL - 국민대학교
                case "ecampus9.kookmin.ac.kr":
                case "lms.shingu.ac.kr": // 신구대
                case "eclass.kbu.ac.kr":
                case "learn.hoseo.ac.kr":
                case "lms.koreatech.ac.kr":
                case "lms.kopia.or.kr":
                    socket = io('//lc.coursemos.kr:28033', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;       
                case "eclass.hywoman.ac.kr":
                case "devlms.cuk.edu": // SSL - 고려사이버대학교
                case "lms.koreacu.ac.kr": // SSL - 고려사이버대학교
                case "lms.dreamai.kr": // SSL - 광주과학기술
                case "elearn.gwangju.ac.kr":
                case "slms.sungshin.ac.kr":
                case "www.barunacademy.co.kr":
                    //socket = io('//lcm.coursemos.kr:28021', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                    socket = io('//lc.coursemos.kr:28034', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                case "openlearn.inha.ac.kr":
                case "eclass.yeonsung.ac.kr":
                case "lms.koje.ac.kr":
                case "lms.bbits.ac.kr":
                case "edulms.kiha21.or.kr":
                case "www.ai-hied.com":
                    socket = io('//lc.coursemos.kr:28035', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;                
                case "cosslms.daelim.ac.kr": 
                case "lms.gwlrs.ac.kr":
                case "lms.kaywon.ac.kr":
                case "online.sejong.ac.kr":
                case "lms.jst.ac.kr":
                case "lms.karts.ac.kr":
                case "eclass.wsi.ac.kr":
                    socket = io('//lc.coursemos.kr:28036', {query: "token=" + token, path: '/socket.io/checker', transports: ['websocket']});
                break;
                /*
                case "lms.snue.ac.kr":
                    socket = io('//lc.coursemos.kr:28050', {query: "token=" + token + "&origin=https://dev.moodler.kr", path: '/socket.io/checker', transports: ['websocket']});
                break;                
                */
                default:
                    //socket = io('//lc.coursemos.kr/', {query: "token=" + token, path: '/checker', transports: ['websocket']});
                    socket=null
                break;
            }

            if (socket != null){
                socket.on('msg', function (data) {
                    var action = data.action;
                    console.log(action)
                    switch(action){
                        case "connected":
                            
                        break;
                        case "pause": 
                            learningCheckerV2.remoteVodPause(socket);
                        break;
                        case "replay":
                            learningCheckerV2.remoteStartReplay(socket);
                        break;
                    }
                });			
            
            }          
        };

        learningCheckerV2.redirectXNCommons = function() {
	        console.log("redirectXNCommons")
        };

            
        learningCheckerV2.remoteStartReplay = function() {
            learningCheckerV2.player.play(); 
            $("#block-ui").css("display","none");
            $("#block-ui").html("");	
        };


        learningCheckerV2.remoteVodPause = function(socket) {
            
            var path = window.location.pathname;
            self.opener = self;
            self.close();
            socket.close();
            
            if(path == "/mod/vod/viewer.php"){
                var playerid = learningCheckerV2.player.id();

                learningCheckerV2.player.pause(); 
                learningCheckerV2.player.dispose();

                $("#" + playerid).remove();
                var html = "<div class='box-detected-vodplayer'>다중 동영상 플레이가 감지되었습니다. <br/>현재 창의 동영상 플레이를 중단합니다.<br/><br/>";
                //html += "<div class='btn-remote-restart-vod'>다시 시작하기</div>";
                html += "</div>";
                
                html = $.parseHTML(html);
                
                $(html).find(".btn-remote-restart-vod").mouseover(function(){
                    $(this).css("font-weight","bold");
                }).mouseleave(function(){
                    $(this).css("font-weight","");
                }).click(function(){
                    socket.emit('request_replay');
                });
            
                $("#block-ui").html("");
                $("#block-ui").append(html);
                $("#block-ui").css('display','block');
                alert("다중 동영상 플레이가 감지되었습니다. 현재 창의 동영상 플레이를 중단합니다.");
                
            
            }
            else if(document.domain == "lms.chungbuk.ac.kr" && path == "/mod/vod/view.php"){
                var playerid = learningCheckerV2.player.id();

                learningCheckerV2.player.pause(); 
                learningCheckerV2.player.dispose();

                $("#" + playerid).remove();
                var html = "<div class='box-detected-vodplayer'>다중 동영상 플레이가 감지되었습니다. <br/>현재 창의 동영상 플레이를 중단합니다.<br/><br/>";
                //html += "<div class='btn-remote-restart-vod'>다시 시작하기</div>";
                html += "</div>";
                
                html = $.parseHTML(html);
                
                $(html).find(".btn-remote-restart-vod").mouseover(function(){
                    $(this).css("font-weight","bold");
                }).mouseleave(function(){
                    $(this).css("font-weight","");
                }).click(function(){
                    socket.emit('request_replay');
                });

                const blockUI = document.createElement('div');
                blockUI.className = 'block-ui';
                blockUI.id = 'block-ui';
                blockUI.style.zIndex = '9999';
                
                $(".vod-viewer").append(blockUI);
                $("#block-ui").html("");
                $("#block-ui").append(html);
                $("#block-ui").css('display','block');
                alert("다중 동영상 플레이가 감지되었습니다. 현재 창의 동영상 플레이를 중단합니다.");
                
            
            }
            else if(path == "/mod/xncommons/viewer.php"){
                
                var html = "<div class='box-detected-vodplayer'>다중 동영상 플레이가 감지되었습니다. <br/>현재 창의 동영상 플레이를 중단합니다.<br/><br/>";
                html += "<div class='btn-remote-restart-vod'>다시 시작하기</div>";
                html += "</div>";
                
                html = $.parseHTML(html);
                
                $(html).find(".btn-remote-restart-vod").mouseover(function(){
                    $(this).css("font-weight","bold");
                }).mouseleave(function(){
                    $(this).css("font-weight","");
                }).click(function(){
                    location.reload();
                });
            
                $("#block-ui").html("");
                $("#block-ui").append(html);
                $("#block-ui").css('display','block');		
                
                $("#vod_viewer").find("iframe").attr("src", "");
                $("#vod_viewer").find("iframe").css("background-color", "white");

                $("#viewer .viewer-content").find("iframe").remove();
                /*
                $("#viewer .viewer-content").find("iframe").attr("src", "");
                $("#viewer .viewer-content").find("iframe").css("background-color", "white");	
                */
                alert("다중 동영상 플레이가 감지되었습니다. 현재 창의 동영상 플레이를 중단합니다.");
            }else if(path == "/mod/econtents/viewer.php"){
		
                var html = "<div class='box-detected-vodplayer'>다중 동영상 플레이가 감지되었습니다. <br/>현재 창의 동영상 플레이를 중단합니다.<br/><br/>";
                html += "<div class='btn-remote-restart-vod'>다시 시작하기</div>";
                html += "</div>";
                
                html = $.parseHTML(html);
                
                $(html).find(".btn-remote-restart-vod").mouseover(function(){
                    $(this).css("font-weight","bold");
                }).mouseleave(function(){
                    $(this).css("font-weight","");
                }).click(function(){
                    location.reload();
                });
            
                $("#block-ui").html("");
                $("#block-ui").append(html);
                $("#block-ui").css('display','block');		
                
                $("#econtents_viewer").find("iframe").remove();
                /*
                $("#econtents_viewer").find("iframe").attr("src", "");
                $("#econtents_viewer").find("iframe").css("background-color", "white");	
                */
                alert("다중 동영상 플레이가 감지되었습니다. 현재 창의 동영상 플레이를 중단합니다.");                	
            }else{ // VOD 가 아닌경우	
                switch(domain){
                    case "devlms.cuk.edu":
                    case "lms.koreacu.ac.kr":
                        if(path != "/"){
                            window.location.href = '/';
                        }
                    break;	
                }
        
            }

            console.log(self)
            /*
            setTimeout(function(){
                self.opener = self;
                self.close();
                socket.close();
            }, 500)
            */

        };

        return {
            init: learningCheckerV2.init
        };
    }
);