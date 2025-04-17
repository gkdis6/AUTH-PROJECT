// src/user/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { Exclude } from 'class-transformer'; 

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') // UUID를 기본 키로 사용
  id: string;

  @Column({ unique: true }) // 사용자 이름은 고유해야 함
  username: string;

  @Column({ unique: true }) // 이메일은 고유해야 함
  email: string;

  @Column()
  @Exclude()
  password_hash: string; // 해싱된 비밀번호 저장

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.USER, // 기본 역할은 USER
  })
  role: Role;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true }) // Refresh Token은 null일 수 있음 (로그아웃 상태)
  @Exclude() // 응답 객체에 포함되지 않도록 설정 (중요!)
  currentHashedRefreshToken?: string;
}