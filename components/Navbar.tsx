import { IconExternalLink } from "@tabler/icons-react";
import { FC } from "react";

import Image from "next/image";
import logoPlatanus from "../assets/logo-platanus.png";
import logoSmartup from "../assets/logo-smartup.png";
import logoPv from "../assets/logo-pv.png";

export const Navbar: FC = () => {
  return (
    <div className="flex h-[60px] border-b border-gray-300 py-2 px-8 items-center justify-between">
      <div className="font-bold text-2xl flex items-center">
        <Image src={logoPlatanus} alt="Platanus Logo" className="h-8 mr-2 w-auto" />
        <a
          className="hover:opacity-50"
          href="https://paul-graham-gpt.vercel.app"
        >
          Platanus GPT</a>
        <Image src={logoPv} alt="Platanus Logo" className="h-8 mr-2 w-auto" />

      </div>
      <div>
        <a
          className="flex items-center hover:opacity-50"
          href="https://www.SmartUpChile.com"
          target="_blank"
          rel="noreferrer"
        >
          <Image src={logoSmartup} alt="Platanus Logo" className="h-8 mr-2 w-auto" />
          <div className="hidden sm:flex">SmartUpChile.com</div>

          <IconExternalLink
            className="ml-1"
            size={20}
          />
        </a>
      </div>
    </div>
  );
};
