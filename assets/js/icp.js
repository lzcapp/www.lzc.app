import punycode from "./punycode";

const hostname = window.location.hostname;
let firstLevelDomain = punycode.toUnicode(hostname.split('.').slice(-2).join('.').toLowerCase());

let ipLink = document.getElementById("icp");
let icpSpan = document.getElementById("icpSpan");

ipLink.target = "_blank";

if (firstLevelDomain.includes("罗子琛.网址") || firstLevelDomain.includes("xn--i8sw09cq3h.xn--ses554g")) {
    ipLink.href = "https://beian.miit.gov.cn/";
    ipLink.innerText = "粤ICP备2023142758号-1";
    document.title = "罗子琛.网址";
} else if (firstLevelDomain.includes("seeleo.com")) {
    ipLink.href = "https://beian.miit.gov.cn/";
    ipLink.innerText = "粤ICP备2023142758号-2";
} else if (firstLevelDomain.includes("lzc.app")) {
    ipLink.href = "https://icp.gov.moe/?keyword=lzc.app";
    ipLink.innerText = "萌ICP备20232302号";
} else {
    icpSpan.style.display = "none";
}

console.log(`
                                  $$$X       &$$
                                $x$      &$
                         &&$$$$$$$$&$$$$$$
                     $$$$$$$$$$$$$$XxX$Xxx$$$
                   X$$$$$$$X$$$$$$$XXXXXXxXXX$$
                 $$&$$$$$$$$$$$$$$$XXXXXXXXXXxxX$
                $&$$$$$$X$$$$$$$$$$X$XXXX$XXXXxxxXx
              X$&$$$$$XX$$$xXxx$$x;;;;;;;xxxxxxxx+x$
              &&$$$$$$$$$$XX$$X$$XXxxxxxxx$xxxxxxx+xx
             $&$$$$$$$$&$$$$$$$XXXXXXXXXxxXxxxxxxx+;+X
           x&&$$$$$$$$&$$$$$$$$$$XXXXXXXXx$xxxxxxx+;;+X$
          $&&&$$&$$$$$$$$$$$x;$$$$$$$XXXxx&Xxxxxxxx;+x++xXXxxxx
       X$$&$$$$&$$$$$$$$$$$$x;x$$$$$$xXXxxxxxxxxxxx;;x++xx++xx
     XXX $$&$&$&x$$$$$$&xxx$$xx$$$$$$xxXXX+;xxxxxx;+;x;;xX&$
        $$$&$&$XxX$$$$$&$&$$$$&x$$$$$xxxxxx$$$$xxx;+;+++;+x
       $&$&$&$&x$X$$$&&&x$XxXXx+x$$$$xX$$$$$$x$$x++;+x++++xx
      $&& &&$&$X$&X$$$$&x;xx;x;;;x$$Xx+;xxxxx+x$x+;+x++x++++
      $$  $$$$&$&$$x$$&&$$x;;;;;;+;;;;;;$;+x:;xX;xXx;x++;;++
      $X  $$&&$&$$&$$$$$$x;;;;;;;;;;;;::::;;+xX$$xxx++X+;;xxx
      $  $$$&$&$&$$$$$$$$$+;;;;;;;;;;:;:;x+x+$Xxxxx;++xx;+xxx
      X   $$$&$&$$$&$$&$$$$$$+;;;;;;;;:::;:xXxxxxx$x++xX;x xx
          $$$$$$$$$$$&$$$xX$$&x;;;;;;:;;x$xxxxxxxx x+x$$X  x
           $$   $$$$$$$$$$xXX$xX&&x+x$Xxxxxxxxxx$  x+$$
                  $ &$$X$$$$Xx$xxX$x;$xXxxx$$&&X&& $ $
               x$&&Xxxx$&X$xx&Xxx++;;X$x$$$$x;;;;:Xxx$
              Xx;;++;;;+;x$&Xxxx++x;;+;;+xX$;;;;;;+;;x$
              $&X+;x++;;+$$$xxxxxxXxx+++++X$$:;;;+;::xx$
              $XxX;;x++;x$$x;++xxxxx+$+;;;X$$+;x;;:;$xx
              Xx+xx;;;x;$$X;;;;;;;+;;;;;;;;X$$$;::;;;;:$
              Xx+++;+;x$&$$;;;;;;xx;xx;;;;;x$$$;Xx+;:;:+
              X+;;;;x$$$$&$;;;;;;;xxX;;;;;xx&$$&&x;::::;
              x+;;;;;;$&&$&&x;;;;;:;;;++;;+&$$X$&X:::::;
              x+;;;+;&&$$$&$&$x++;;;;+;;x$$$$$$$$X$x;;:;
             $&xx+++$$$$$$$$$&&$x;;+x;+x$$$$$$$$$$XX++:x$
           xXxxxxxxX&$$$$$&&&&&&&$x;;x$$$$$$$$$$$$$$$;+;x;+
            xxX$xxx$&$$$$&&&&&&&&&&xx$$&&$&$$$$$$$$$xx:;;x
    `);
console.log(`

    ██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗
    ██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝
    ██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗
    ██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝
    ╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗
    ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝

    `)
console.log(`

    Welcome to ${firstLevelDomain}!

    `);