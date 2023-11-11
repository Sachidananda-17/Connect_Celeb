"use client";


import { Companion } from "@prisma/client";
import { ChatMessage, ChatMessageProps } from "./chat-message";
import { ElementRef, useEffect, useRef, useState } from "react";



interface ChatMessagesProps {
  messages: ChatMessageProps[];
  isLoading: boolean;
  companion: Companion
}

export const ChatMessages = ({
  messages = [],
  isLoading,
  companion,
}: ChatMessagesProps) => {

  const scrollRef = useRef<ElementRef<"div">>(null);

  const [fakeLoading, setFakeLoading] = useState(messages.length === 0 ? true : false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFakeLoading(false);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    scrollRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  
  return (
    <div className="flex flex-col min-h-screen">
    <div className="flex-1 flex flex-col-reverse overflow-y-auto pr-4">
      <ChatMessage
      
      src={companion.src}
      role="system"
      content={`Hello, I am ${companion.name}, ${companion.description}`}
      />
      </div> 
      {messages.map((message) => (
        <ChatMessage
          key={message.content}
          src={companion.src}
          content={message.content}
          role={message.role}   
        />
      ))}

     {isLoading && (
        <ChatMessage
          src={companion.src}
          role="system"
          isLoading
        />
      )}
 <div ref={scrollRef} />
</div>
      
      
      
  );
};